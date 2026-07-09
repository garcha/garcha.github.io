---
title: "Daily Sikhi"
tagline: "Grounded RAG Q&A over the Sri Guru Granth Sahib Ji"
description: "A Rails 8 study app for the Sri Guru Granth Sahib Ji — side-by-side Gurmukhi, transliteration, and English translation with a citation-grounded Q&A that only answers from retrieved passages."
status: "beta"
featured: true
order: 4
url: "https://dailysikhi.com"
techStack: ["Ruby on Rails 8", "PostgreSQL", "pgvector", "OpenAI API", "Turbo", "Tailwind CSS", "Render", "Claude Code"]
category: "personal"
startDate: 2025-01-01
problem: "Studying the Sri Guru Granth Sahib Ji online usually means jumping between sites for the Gurmukhi, transliteration, and English translation, with no way to ask a question and get answers grounded strictly in the text."
solution: "A single reader with all three scripts side-by-side, plus a hybrid-retrieval (FTS + pgvector) Q&A layer that only answers from cited passages — refuses when nothing relevant is retrieved, and verifies every Ang citation in code before showing the answer."
impact: "Enables focused study of the SGGS with grounded, cited answers — no invented commentary, every claim traceable to an Ang."
---

## Overview

Daily Sikhi is a private Rails 8 app for studying Sri Guru Granth Sahib Ji (SGGS) — the Sikh scripture, 1,430 Angs. The reader shows Gurmukhi script, transliteration, and English translation side-by-side on one screen. The source text is the SBS (Uni) translation by Dr. Sant Singh Khalsa, with transliteration and database by Dr. Kulbir S. Thind. Access is controlled while permissions from the rights holders are pending.

## Key Features

- **Side-by-side reader**: Gurmukhi, transliteration, and English on one screen, organized by Ang and shabad
- **Hybrid search**: Postgres full-text search plus pgvector cosine similarity, fused with Reciprocal Rank Fusion
- **Grounded Q&A**: Ask questions like "What does Gurbani say about ego?" — answers cite passages by Ang, refuse if nothing relevant is retrieved, and verify every citation in code before display
- **Permanent question store**: Every Q&A pair is saved as a real Postgres record; repeat questions skip the OpenAI API entirely
- **Daily Hukamnama**: Fetches today's Ang pointer from SikhNet's dated archive and renders from the local corpus — no scraping, polite to upstream
- **Raag reference**: ~30 raags with traditional moods (Aasaa — hope, Maaroo — courage) as context for retrieval

## Technical Highlights

- **Retrieval**: RRF over FTS (`tsvector` GIN index) + exact pgvector cosine search at 3,072 dimensions. No ANN index — with 4,076 static shabads, exact search is milliseconds and eliminates approximation error.
- **Fidelity constraint**: System prompt instructs the model to point to the Guru's words, not speak for them. Temperature 0, inline `(Ang N)` citations required, hallucinated citations flagged in code and treated as unsafe.
- **Question DB**: SHA-256 digest of normalized question + model name as lookup key. Refusals are also cached — a static corpus that returns nothing once returns nothing again.
- **One-command deploy**: 4,076 shabad embeddings (~185 MB) committed as sharded JSON seed files. `rails db:prepare` loads the full corpus including vectors — no pandoc, no OpenAI key, no manual steps on the server.

## Posts

- [Building a RAG Ask Feature for the Sri Guru Granth Sahib Ji](/blog/2026-07-01-building-rag-for-the-guru-granth) — retrieval design, fidelity constraint, question DB
- [Shipping Embeddings as Seed Data](/blog/2026-07-01-shipping-embeddings-as-seed-data) — one-command production deploy without any external dependencies
