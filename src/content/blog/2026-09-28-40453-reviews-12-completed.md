---
title: "40,453 Incomplete Reviews, 12 Completed: A Junk-Data War Story"
description: "A 1.3-second GraphQL query led to a cleanup cron that couldn't keep up, a VACUUM that wouldn't start, a tempting partial index — and the real fix, which was to stop creating the junk in the first place."
pubDate: 2026-09-28
tags: ["building-in-public", "engineering", "postgresql", "rails", "performance"]
draft: false
generatedBy: "agent"
---

## Context

A GraphQL request on our Reviews app was spending 1,320 ms in a single query — not the whole request, one query, one merchant, one count of completed reviews grouped by source and channel.

The `reviews` table backing it was large: about 7 million rows, a 6 GB heap, 1.1 GB spread across 13 indexes — all single-column or expression indexes, nothing composite, nothing partial. On paper this looked like "needs an index." It wasn't. It needed a much harder look at what was actually in the table.

## Original Plan

Start with `EXPLAIN (ANALYZE, BUFFERS)` and see what the planner was actually doing, on the assumption that the fix would be "add the right composite index."

The plan said otherwise immediately. This one merchant had **40,453 reviews**, and exactly **12** of them were completed. Postgres was walking roughly 200 MB of scattered heap pages — 26,015 heap blocks — to filter out 40,441 rows and hand back 12. Timing was unstable across runs on the identical query — 263 ms, 795 ms, 1,320 ms — which is the signature of random I/O at the mercy of page-cache luck, not a fixable plan shape.

So the real question stopped being "which index" and became "why does one merchant have 40k incomplete reviews and 12 completions."

## What Changed

The 40k figure wasn't specific to one merchant — it was a symptom of a live incident, and the incident was bots.

Short survey links are public URLs by design: they go on receipts, in text messages, on QR codes. Starting Sept 2026, something started hitting them at roughly 10x normal traffic. Some of it looked like ordinary crawlers and link scanners walking anything that resolves. Some of it looked targeted — the same short links, over and over. It didn't much matter which. The route serving those links persisted a review row — a GET request that writes to the database — so every bot hit minted a new incomplete review, whether or not a human ever saw the form.

That one design decision turned a traffic spike into a data spike. The flood was generating 30k–49k incomplete rows per day across roughly 24k merchants.

There was a nightly job whose entire purpose was to clean this up, capped at 25k deletions a night. Before the bots it handled a few hundred rows and never came close to that cap. The flood handed it on the order of 50k new rows a day. The job didn't crash — it couldn't keep up. 50k in, 25k out, and the gap compounds: that's how the backlog climbed to 347k rows.

This is the first theme worth sitting with: **junk rows are not inert.** They don't just sit there waiting to be cleaned up later at your convenience. They inflate table size, they get scanned by every query that doesn't have a way to skip them, they bloat indexes, they outrun the jobs designed to remove them, and — as it turned out here — they can corrupt application logic that trusts row counts.

## Iterations & Fixes

### The cleanup cron that couldn't keep up

The job itself wasn't broken — everything it was meant to delete had been getting cleaned. It was simply sized for a world that no longer existed. The obvious fix, cranking the cap to 50k or more, would have doubled the nightly delete load on a table already absorbing 50k unwanted inserts a day. Every one of those rows was work the database should never have done once, and raising the cap asks it to do that work twice. That's not a fix; it's a bandaid that hands the database more load.

### DELETE doesn't reclaim anything

The first manual cleanup targeted the ten worst-hit merchants, starting with the one from the original query and its 40k junk rows, and removed almost 250k junk reviews in one pass. Immediately afterward, that query was still 1,070 ms and 26,015 heap blocks. `DELETE` only marks tuples dead; the heap pages and index entries stick around until `VACUUM` runs. And autovacuum wasn't going to trigger on its own — the dead-tuple count sat well under the threshold the table's size required.

`VACUUM FULL` was ruled out: a bloat estimate showed there was no meaningful bloat to reclaim. `FULL` would have rewritten the entire 6 GB table under an exclusive lock for essentially nothing. Plain `VACUUM (ANALYZE)` was the right tool.

### Getting VACUUM to run

Even the vacuum had to be wrangled. The first attempt died with an out-of-memory error, and so did the second. The version of Postgres in production pre-allocates its entire dead-tuple tracking array up front from `maintenance_work_mem`, regardless of how many dead tuples exist, so it was asking the host for 410 MB to track roughly 1.5 MB of actual work — a quarter-million dead tuples at six bytes apiece. Lowering that setting for the session let it finish in a single pass.

## What I Learned

Cleaning up the ten worst merchants was the right first move. Those ten accounted for about 70% of the junk — almost 250k of the 347k rows and clearing them took the pressure off the queries that were actually alerting. That bought the time to do the long-term fix properly instead of under a production alert.

The obvious database side answer is a partial index whose predicate structurally excludes the junk, so junk rows can never enter it in the first place: a composite index on the columns actually used for grouping, restricted to completed, non-deleted reviews, built without locking the table at write time.

But step back and look at what the index actually is: a bandaid over a table that shouldn't have the junk in it at all. It makes one query shape immune. The rows still get written on every crawler hit, still bloat the heap and the other 13 indexes, still inflate the load counter below, still have to be deleted by a nightly job that has already proven it can't keep up. And once the junk is gone, the index exists to defend against a problem that no longer occurs — so you add it under pressure, then have to remember to remove it later.

## The Shipped Fix

The ultimate fix was to change the way reviews are created. A page view on a short survey link no longer persists anything; a review row only comes into existence when a human actually engages with the survey. Crawlers hit the redirect, follow it, and leave nothing behind. That one change made every downstream symptom — the 40,453-to-12 ratio, the drowning cron, the vacuum headaches, the index question — stop refilling.

It also quietly removed a lot of work the database was doing for no one. Every bot hit had been an INSERT, then a nightly DELETE, then dead tuples for vacuum to chase. Not creating the row in the first place eliminates the write _and_ the delete _and_ the vacuum, and the cleanup job goes back to handling a few hundred rows a night instead of racing a flood. We could have shipped the bandaids and they would have worked. Fixing creation instead meant less total work for the database and never adding an index we'd only have to take out again.

## Next Steps

- Confirm the backlog drains to zero and the original query settles on its own once the junk is gone and vacuumed — if it doesn't, the partial index is the next lever, and this time it would be a permanent design choice rather than a patch over an incident.
- Alert when the nightly cleanup job hits its cap. A job that deletes exactly its limit every night is a job that's losing ground, and this one lost ground for weeks because "ran successfully, deleted 25k" looks healthy on every dashboard.
