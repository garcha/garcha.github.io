---
title: "Shipping Embeddings as Seed Data: One-Command Production Deploys"
description: "How precomputing SGGS embeddings locally and committing them as seed data eliminated pandoc, the OpenAI key, and every manual step from production deploy."
pubDate: 2026-07-01
tags: ["building-in-public", "engineering", "rails", "pgvector", "deployment", "sikhi"]
draft: false
generatedBy: "agent"
---

## Context

Daily Sikhi (described in [the previous post](/blog/2026-07-01-building-rag-for-the-guru-granth)) is a private Rails 8 app for studying Sri Guru Granth Sahib. The retrieval layer is hybrid search: Postgres full-text search plus pgvector cosine similarity over 4,076 shabad (hymn) chunks, each embedded with OpenAI `text-embedding-3-large` at 3,072 dimensions.

When the app is working, semantic search and grounded Q&A work cleanly. The problem was getting a fresh production database to that state without a tangle of manual steps.

## The Problem

A fresh deploy on Render means an empty Postgres database. For the site to actually function — not just boot — it needs the full corpus and the embeddings. Without them the app loads fine and search returns nothing.

The naive path had three external dependencies:

**Pandoc.** The source is a `.docx` file (the canonical SGGS translation with author attribution). I use `pandoc --wrap=none` to convert it to plain text before parsing. Render's native Ruby runtime has no pandoc and no `apt` access. So the data pipeline can't run there at all.

**The OpenAI API key.** Re-embedding on the server means calling OpenAI — money, time, and a secret that has to be set before the site works. Not a secret I want in the deploy environment when I can avoid it.

**A manual psql restore.** The fallback was `pg_dump` locally, then `psql` against the Render database URL. It works, but it's an out-of-band manual step that's easy to forget on first deploy. There's no record of whether it ran. A site that loads but returns empty search results is a bad failure mode — it looks like it works.

## The Insight

The embeddings are derived, deterministic data. The corpus doesn't change. Given the same source text and the same model, you get the same vectors. So the right time to compute them is once, locally — where pandoc and the OpenAI key already live — and then commit the result to the repo as seed data.

Rails already runs `db:seed` as part of `db:prepare` in the pre-deploy step. If the seed file loads the full corpus including vectors, the first deploy comes up fully working without touching any external dependency.

## The GitHub File Size Problem

One 3,072-dimension vector serialized as JSON is about 38 KB. Times 4,076 chunks: ~151 MB of embeddings alone. GitHub hard-rejects any single file over 100 MB, so you cannot write one big `seeds.json` and call it done.

The fix is sharding. I split the chunks into files of 1,000 records each — roughly 37 MB per shard — so every file stays well under the limit:

```
db/seeds/dump/
  sections.json               # ~285 KB
  shabads.json                # ~7 MB
  verses.json                 # ~20 MB
  chunks.json                 # ~5 MB  (metadata only, no vectors)
  embeddings/
    embeddings.000.json       # ~37 MB (embeddings for chunks 1-1000)
    embeddings.001.json       # ~37 MB
    embeddings.002.json       # ~37 MB
    embeddings.003.json       # ~37 MB
    embeddings.004.json       # ~3 MB  (the remaining 76)
```

A small module (`SggsSeedDump`) handles both the export and import. Export runs locally after ingestion; import runs from `db/seeds.rb`. It preserves original primary keys so foreign keys line up, lets Postgres regenerate the stored `tsvector` column from the committed text automatically, and writes the embedding arrays back via pgvector's `update_all(embedding: array)` (the `neighbor` gem casts the plain Ruby array to a vector):

```ruby
# in db/seeds.rb — idempotent: skips the import once the corpus exists
if Shabad.exists?
  puts "Corpus already present — skipping."
elsif SggsSeedDump.dump_present?
  SggsSeedDump.import
end
```

That is the entire deploy story for the corpus. `rails db:prepare` → seeds run → the site works.

## Round-Trip Verification

Before trusting this in production, I ran a non-destructive round-trip: wipe the corpus tables, import from JSON, run a semantic search, verify the results match the pre-wipe state — all inside a transaction that rolls back. The embeddings came back bit-identical and search returned the same ranked results. The `transaction { ... ; raise ActiveRecord::Rollback }` pattern is useful here because it confirms the import is correct without leaving the database in a half-loaded state.

## The Tradeoff

This bloats the git repo. The current seed data is about 185 MB committed. More importantly: floating-point vectors are not human-readable text, so git's delta compression doesn't help much. If you ever re-embed — say, to try a different model — you add another ~185 MB blob to history.

For a corpus that changes rarely, this is a fine price for a bulletproof single-command deploy. If the corpus were updated frequently, or if the embedding model changed often, Git LFS or the `pg_dump` path would be a better fit. Git LFS would keep the blobs out of the object store proper while still automating the load on deploy. I haven't needed it yet.

## What I Learned

Move the hard requirements to the machine that already satisfies them. Pandoc and the OpenAI key live on my laptop; the production server needs neither if the work is already done. Precomputing expensive, deterministic data and committing the result means production can be dumb — `rails db:seed`, no more.

The broader principle: the best deploy step is no deploy step. Every manual step between `git push` and a working site is a way for first deploys to come up silently broken. Encoding the corpus as seed data closes that gap entirely.

## Next Steps

- Evaluate whether to move the seed files to Git LFS if re-embedding becomes more frequent.
- Surface a "corpus loaded / not loaded" health check on the admin page, so a partial seed is visible rather than silent.
