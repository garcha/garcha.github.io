---
title: "One Table, Two Doors: Airtable as Shared Memory for My AI Agents"
description: "Turning an Airtable base into a single source of truth that an AI writes to over MCP and I read as a visual board — plus the friction, the wrong turns, and what I'd model differently."
pubDate: 2026-08-01
tags: ["building-in-public", "engineering", "airtable", "ai-agents", "mcp"]
draft: false
generatedBy: "agent-edited"
image: generate_image
---

## Context

The thing that kicked this off was a simple frustration: my AI tools have no memory, and chat is a terrible place to _look_ at my life. Every new session starts from zero. And even when a model does remember something, "show me all my active projects and what's next" is a question a chat window answers badly. I don't always want to _do_ something — sometimes I just want to _see_ the state of things.

I already had a personal app for some of this — Lidger — but it's rigid by construction. Every feature is a hand-coded table plus a hand-coded endpoint: one path for daily focus, and one for health tracker, all funneled through a single bespoke webhook (which, amusingly, I'd already named `/openclaw` before any of this). An AI can reach it, but only through one custom skill I wrote, and adding a new kind of thing to track means writing new backend code. That's fine for a focused health tracker. It's the wrong shape for "hold everything in my life that an agent might reason over."

So the real goal was narrow and concrete: **one data store that an AI can read and write through MCP, and that I can view and edit through a real interface — not a chatbot.** Same data, two doors.

## Constraints

- **Time.** I wanted something usable the same day, not a multi-week rebuild of Lidger's backend into a general-purpose store.
- **Uncertainty about the foundation.** Build my own app? Adopt Supabase and hand-roll a UI? Notion? Airtable? Each is a different multi-week bet, and I didn't want to discover the wrong one after building on it.
- **Permissions and access, which turned out to be the real tax.** The Airtable MCP integration can only see bases it's explicitly granted. Shared views from _other people's_ bases returned `403`. The public share pages are blocked to automated fetching by `robots.txt`. And at one point the integration's scope silently narrowed from 12 bases to 1 mid-session — a reminder that access is state, and it changes under you.
- **API gaps I only found by hitting them.** You can't edit an interface page's filter in place (you delete and recreate the page). There's no delete-field call. You can't rename or merge existing single-select options. A link field targets exactly one table. None of these are dealbreakers, but each one quietly shapes the design.
- **Risk discipline.** Destructive operations (deleting a table or a page) are gated behind explicit confirmation, and I wanted every move to be reversible.

## Options Considered

**Keep building on my own app (Lidger or a new one).** Maximum control, and the data would already be mine. But it's also the slowest path, and the whole reason I was here is that the app-per-feature shape doesn't generalize. Rejected for now — though the exercise clarified that a real backend is exactly what I'd be reinventing.

**Supabase + a custom visual layer.** This is the architecture the video that inspired me actually describes: a Postgres table, an MCP server, a hand-built dashboard deployed somewhere. Genuinely flexible. But it means rebuilding auth, hosting, and a UI I'd then have to maintain — and if I ran it _next to_ Lidger, I'd have two sources of truth, which is the exact fragmentation I was trying to escape.

**Notion + Notion MCP.** Great for notes-plus-light-structure and unbeatable for template distribution. But as a _deterministic data layer for agent writes_, its page/block model is looser than I wanted. Writes are fiddlier and its "databases" are weaker databases.

**Airtable + Airtable MCP.** A real relational database — typed fields, linked records, a clean and predictable API — with native Interfaces for the human-facing board, and an official MCP server with full read/write. This is the one that gives me both doors out of the box.

## Decision

I went with **Airtable as the shared data layer**: the agent reaches it over MCP, I reach it through an Interface. One base — "Projects & Work" — with:

- **Projects** — a row per venture/side project, with status, priority, focus, blockers, notes.
- **Work Tasks** area for work items.
- **Tasks** — a _single_ table holding every task, linked to its parent via one link column per parent table.

That last choice is the interesting one. I wanted one combined task list across everything, but I also wanted a couple of areas kept as their own tables. In Airtable a link field points to exactly one table, so "one Tasks table linked to everything" means the Tasks table carries one link column per parent, and each task fills whichever applies. It works — but it's a visible seam. The cleaner design (which I flagged to myself at the time) is a single "Areas" table with a Category field, so Tasks needs just one link column and a cross-area board groups cleanly. I took the more-tables path anyway because one area (job applications) genuinely has a different shape and deserved its own table. The tradeoff: cross-area views now lean on filters and dates rather than a single group-by.

On top of the Tasks table I built a Kanban **Interface** — the "All Tasks Board" — grouped by a `Stage` single-select. Because every task lives in one table, they're all on one board regardless of which area they belong to. That's the payoff of the unified-tasks decision: the combined view is free.

## Outcome

It works, and it came together fast. The base, three tables, the project rows, and a published board all went up in one session. The agent creates and updates records; I open the interface on my phone and see the board. Two doors, one table — exactly the goal.

## What I'd Change

- **Define the controlled vocabulary for single-selects up front**, and only ever write option names that already exist. The typecast-auto-creates-options behavior is convenient right up until it silently forks your vocabulary. Pick the strings first; treat them as an enum.
- **Do schema edits in one place.** Mixing API-driven and hand-driven schema changes is how I ended up with three spellings of the same status. Either the agent owns the schema or I do — not both, not at the same time.
- **Decide the source of truth for "done" once.** I ended up with both a `Done` checkbox and a `Stage` of `Done`. Two signals for one fact is one too many.
- **Design around the API's missing verbs.** No delete-field, no option rename/merge, no in-place page-filter edit. Knowing that, I'd get the field set and the vocabulary right in the initial `create_table` call rather than iterating into corners I can't back out of cleanly.

## What I Learned

The insight that actually transfers isn't "use Airtable." It's the _shape_: **one table as the single source of truth, with two interfaces on top of it — an agent door (MCP) and a human door (a board).** Once you see the problem that way, the tool question mostly answers itself. Airtable happens to ship both doors, which is why it was the fastest path to a memory layer I can also look at.

## Next Steps

- Consolidate to the unified "Areas" model and clean up the duplicate `Stage` options in the UI.
- Decide whether this stays a personal command center or turns into something worth handing to other people. The architecture is general; the packaging is the open question.
