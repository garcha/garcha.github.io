---
title: "Building a RAG Ask Feature for the Sri Guru Granth Sahib Ji - Only answer with text references"
description: "How I built a citation grounded Q&A assistant for studying Sri Guru Granth Sahib Ji in a private Rails 8 app: hybrid retrieval, a strict fidelity system prompt, and a question DB that saves every answer permanently."
pubDate: 2026-07-01
tags: ["building-in-public", "engineering", "rag", "rails", "pgvector", "sikhi"]
draft: false
generatedBy: "agent-edited"
---

## Context

[Daily Sikhi](https://dailysikhi.com) is a Rails 8 app I built to study the Sri Guru Granth Sahib Ji (SGGS) — the Sikh scripture, 1,430 Angs (pages). The goal was a clean side-by-side reader: Gurmukhi script, transliteration, and English translation together on one screen. The source text is the "SBS (Uni)" docx from gurbanifiles.net — translation by Dr. Sant Singh Khalsa, transliteration and database by Dr. Kulbir S. Thind. The app is access-controlled for now because permission from the rights holders is still pending.

Once the reader worked, I wanted to go further: a semantic search and a grounded Q&A assistant that could answer questions like "What does Gurbani say about ego?" by retrieving and citing relevant passages — without ever inventing an interpretation. That second constraint turned out to be the interesting engineering problem.

## Getting the Data In

The docx has a beautifully regular structure. Every verse is a three-paragraph block — Gurmukhi line, transliteration, English translation — separated by a blank line, with "Page N" markers between groups. This is the kind of structure that makes a parser trivial to write. I verified the counts: exactly 60,477 verse blocks and 1,430 page markers. Both match expectations for a complete SGGS.

One non-obvious gotcha: I used `pandoc` to convert the docx to plain text, and it had to be `pandoc ... -t plain --wrap=none`. Without `--wrap=none`, pandoc line-wraps long paragraphs at the terminal width. A parser that splits on blank lines then sees two "paragraphs" where there should be one, and the verse block count goes wrong. I verified it empirically — wrong counts without the flag, right counts with it. Small thing, worth writing down.

The retrieval unit is the shabad (hymn), not the individual verse. A shabad is a complete compositional unit. There are 4,076 shabads. Citation granularity is Ang (page) + raag + author (Mehl), because the source file has no line-level identifiers, and Ang is the standard reference convention anyway.

## Retrieval: Hybrid Search Without a Reranker

I chose hybrid retrieval — Postgres full-text search plus pgvector cosine similarity — fused with Reciprocal Rank Fusion:

```
score = 1/(k + rank_fts) + 1/(k + rank_vec)   (k = 60)
```

Two independent signals for surfacing the right shabad: exact-term matching (FTS) and semantic meaning (vector). RRF doesn't require calibrated scores from either side; it just combines ordinal ranks, which makes it simple to implement. This recovers most of what a dedicated reranker would add, without introducing a second vendor or a second API round-trip.

Embeddings use OpenAI `text-embedding-3-large` at 3072 dimensions. One chunk per shabad: the English translation with a light raag/author prefix. Gurmukhi is deliberately kept out of the embedded vector — English embedding models handle it poorly, and it lives in a separate column for display only.

### The 3072-Dimension Index Problem

An interesting pgvector constraint: ANN indexes (HNSW, IVFFlat) are capped at 2000 dimensions. At 3072 dims you cannot use them. The initial migration draft had an HNSW index and 1536 dimensions — both wrong. The fix was to drop the index entirely and run exact cosine search. With only 4,076 static rows, exact search is milliseconds. No approximation error, no index maintenance. "No index" turned out to be the fidelity-first choice, not a compromise.

FTS lives on a Postgres `STORED` generated `tsvector` column, GIN-indexed, computed from the shabad's Latin-script text (transliteration + English). Fast, no extra moving parts.

### The AND-to-OR Fallback Bug

`websearch_to_tsquery` ANDs all terms by default. A query like "what does Gurbani say about ego" matched exactly zero rows because the word "gurbani" never appears in the English translation corpus. The fix: when the strict AND query returns empty, fall back to an OR of the significant terms using `to_tsquery`, still ranked by `ts_rank` so the most relevant passages surface first. After the fix: "ego pride" → 32 hits; the full natural-language question → correct results via OR fallback. Simple, but it would have silently broken the feature without the fallback.

## Limiting Creativity — The Hard Part

This is the part I thought about most carefully. The SGGS is scripture. The generated answer is not commentary; it must only point to what the Guru's words actually say. That framing — "you point to the Guru's words, you do not speak for them" — became a literal line in the system prompt.

The rules I enforced:

1. **Answer only from supplied passages.** No background knowledge about Sikhism, theology, or anything outside the retrieved context.
2. **Quote and cite inline.** Every claim in the answer must be followed by `(Ang N)`.
3. **Relevance gate.** If no retrieved passage addresses the question, respond with an exact refusal string and stop. No hedging, no partial attempts.
4. **Temperature 0.** Reproducibility and predictability over variation.

In code, after generation, I parse every Ang the model cited and verify each one appears in the retrieved set. If the model hallucinates a citation — references "Ang 999" when that wasn't in the context — it gets flagged (`citation_ok: false`) and the answer is treated as unsafe.

### Tuning the Gate

The first version of the relevance gate was too strict. A question like "What does Gurbani say about conquering ego?" got refused even though clearly relevant passages were retrieved — for instance, Ang 560, M3: _"Ego is opposed to the Name of the Lord."_ The gate wording was something like "refuse if the passages do not directly address the question," and the model read that as permission to be maximally cautious.

The fix was a small but meaningful rewrite: "use whichever passages speak to the question's theme; only refuse if none relate." After that change: on-topic questions with relevant passages → a grounded, cited answer. Off-topic questions ("best pizza toppings") → correct refusal. This tension — never hallucinate versus don't be uselessly timid — is the real challenge when you're trying to ground an LLM on a specific corpus. The gate needs a threshold, not a binary wall.

## The Question DB

Calling an embedding API and a generation API on every ask adds latency and cost. For a static corpus — scripture doesn't change — the answer to a given question is deterministic. So I built a permanent question store: a `qa_answers` Postgres table where every question and its generated answer is saved as a real record, not as a cache entry with an expiry.

The lookup key is a SHA-256 digest of the normalized question (downcased, whitespace-collapsed) plus the model name. Including the model name in the digest means a model upgrade creates a new record rather than serving an answer generated by a different model.

On a repeat question: the saved answer is returned and its source shabads are rehydrated from the local database. Zero OpenAI calls — no embedding, no generation. I verified this with explicit call counting: first ask triggers one embed call and one chat call; second identical ask triggers neither, `times_asked` increments to 2, and the answer is byte-for-byte identical. The record survives process restarts because it's in Postgres.

A few details worth noting:

- Refusals are also saved. For a static corpus, a question that returned nothing the first time will return nothing again — saving the refusal is correct.
- The no-API-key placeholder state is deliberately not saved. There's nothing to save yet.
- The table tracks `times_asked` and `last_asked_at`, so there's a real usage history as a side effect.

The reason this works cleanly here — and wouldn't in many other RAG applications — is the static corpus assumption. If the underlying data changes, cached answers can go stale. For a text that was completed in 1708, that's not a concern.

## Other Things Worth Noting

**Hukamnama.** Rather than scrape and republish another site's daily text, the app consumes only the pointer — it fetches which Ang today's Hukam is from SikhNet's dated archive, then renders that shabad from its own ingested text. A fallback chain keeps the page alive: today's fetch, then yesterday's stored record, then a deterministic local rotation. One fetch per day, polite to the upstream.

**Search and Ask unified.** I initially built separate Search and Ask pages. During testing I noticed that even plain keyword queries like "greed" or "humility" through the Ask interface produced useful, grounded answers from retrieved passages. The distinction between "search" and "ask" collapsed. One page does both.

**Turbo form gotcha.** The Ask form was a POST. Turbo requires POST responses to redirect, otherwise it throws "Form responses must redirect to another location" and nothing renders. The fix was to make it a GET — asking a question is a read, not a mutation. That's the correct HTTP semantics anyway.

**Raags.** The SGGS is organized by raag (musical mode). I added a reference of around 30 raags with their traditional moods — Aasaa (hope), Maajh (longing in separation), Maaroo (courage and fearless truth). Raags don't have literal translations; the emotional mood is the meaningful context. This turns out to matter for retrieval: knowing a shabad is in Maaroo tells you something about its tenor before you've read a word.

**Testing the AI layer.** The test suite is fully stubbed — no real OpenAI calls. Tests verify: the question DB replay makes zero API calls on the second ask; the refusal gate fires on off-topic questions; and citation flagging catches hallucinated Ang references.

## What I Learned

The through-line across every decision here was fidelity over cleverness. Exact cosine search over an approximate ANN index. Full-text AND-to-OR fallback over silently returning zero results. Permanent records over a cache with an expiry. Hard citation verification in code, not just in the prompt. A generation model told to stop rather than infer.

The RAG pattern itself is not new. What made this feel different was the subject matter. Getting the model to stay in its lane when the corpus is scripture — where improvised commentary is not just unhelpful but arguably disrespectful — required real care. The relevance gate tuning was the most iterative part of the whole build, more so than the retrieval or the data ingestion.

The phrasing I kept coming back to in the system prompt: "you point to the Guru's words, you do not speak for them." That constraint, taken seriously, shapes every technical decision downstream.

For how I got this whole retrieval layer into production without pandoc, an OpenAI key, or any manual steps, see the follow-up: [Shipping Embeddings as Seed Data: One-Command Production Deploys](/blog/2026-07-01-shipping-embeddings-as-seed-data).

## Next Steps

- Waiting for permissions request from the rights holders and make the app public if granted.
- Explore per-raag browsing and the raag reference as a learning tool in its own right.
- Evaluate whether the question DB should surface semantically similar prior answers (fuzzy match on normalized embedding) rather than only exact-question matches.
