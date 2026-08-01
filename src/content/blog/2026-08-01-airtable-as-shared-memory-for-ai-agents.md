---
title: "One Table, Two Doors: Airtable as Shared Memory for My AI Agents"
description: "Turning an Airtable base into a single source of truth that an AI writes to over MCP and I read through a structured visual surface — plus the friction, the wrong turns, and what I'd model differently."
pubDate: 2026-08-01
tags: ["building-in-public", "engineering", "airtable", "ai-agents", "mcp"]
draft: false
generatedBy: "agent-edited"
image: "/images/blog/structured_visual_surface.png"
---

## Context

AI tools do have memory — markdown files, tools like Honcho, persistent context layers. But all of it is chat-referenced: you have to prompt to see anything. "Show me all my active projects and what's next" is a round-trip. I don't always want to _do_ something or _ask_ something — sometimes I just want to _look_.

Chat is the wrong interface for that. It answers questions; it doesn't show you the state of things. A board does. A kanban with everything in it tells you where things stand the moment you open it, without a single prompt.

The goal was narrow and concrete: **one data store that an AI can read and write through MCP, and that I can view and edit through a structured visual surface — not another chatbot.** Same data, two interfaces.

## Constraints

- **Time.** I wanted something usable the same day, not a multi-week build.
- **Uncertainty about the foundation.** Build my own app? Adopt Supabase and hand-roll a UI? Notion? Airtable? Each is a different multi-week bet, and I didn't want to discover the wrong one after building on it.
- **Permissions and access, which turned out to be the real tax.** The Airtable MCP integration can only see bases it's explicitly granted. Shared views from _other people's_ bases returned `403`. The public share pages are blocked to automated fetching by `robots.txt`. And at one point the integration's scope silently narrowed from 12 bases to 1 mid-session — a reminder that access is state, and it changes under you.
- **API gaps I only found by hitting them.** You can't edit an interface page's filter in place (you delete and recreate the page). There's no delete-field call. You can't rename or merge existing single-select options. A link field targets exactly one table. None of these are dealbreakers, but each one quietly shapes the design.
- **Risk discipline.** Destructive operations (deleting a table or a page) are gated behind explicit confirmation, and I wanted every move to be reversible.

## Options Considered

**Keep building my own app.** Maximum control, data already mine. But also the slowest path, and the app-per-feature shape is exactly what doesn't generalize. Rejected — though the exercise confirmed I'd just be reinventing a backend.

**Supabase + a custom structured visual surface.** Genuinely flexible — a Postgres table, an MCP server, a hand-built dashboard. But it means rebuilding auth, hosting, and a UI I'd have to maintain, with no structured visual surface out of the box. A multi-week bet for something I wanted today.

**Notion + Notion MCP.** Great for notes-plus-light-structure and unbeatable for template distribution. But as a _deterministic data layer for agent writes_, its page/block model is looser than I wanted. Writes are fiddlier and its "databases" are weaker databases.

**Airtable + Airtable MCP.** A real relational database — typed fields, linked records, a clean and predictable API — with native Interfaces as the structured visual surface, and an official MCP server with full read/write. Both interfaces, out of the box.

## Decision

I went with **Airtable as the shared data layer**: the agent reaches it over MCP, I reach it through an Interface. One base — "Projects & Work" — with:

- **Projects** — a row per venture/side project, with status, priority, focus, blockers, notes.
- **Work Tasks** area for work items.
- **Tasks** — a _single_ table holding every task, linked to its parent via one link column per parent table.

That last choice is the interesting one. In Airtable, a link field points to exactly one table — so a unified Tasks table means one link column per parent, each task filling whichever applies. It works, but it's a visible seam. The cleaner design is a single "Areas" table with a Category field, so Tasks needs only one link column and the structured visual surface can group across everything cleanly. The tradeoff: cross-area views now lean on filters rather than a single group-by.

On top of the Tasks table I built a Kanban Interface — the "All Tasks Board" — grouped by a `Stage` single-select. Because every task lives in one table, they all appear on one structured visual surface regardless of area. That's the payoff of the unified-tasks decision: the combined view is free.

## Outcome

It works, and it came together fast. The base, three tables, the project rows, and a published board all went up in one session. The agent creates and updates records; I open the structured visual surface on my phone and see the state of things. Same data, two interfaces — exactly the goal.

## What I'd Change

- **Define the controlled vocabulary for single-selects up front**, and only ever write option names that already exist. The typecast-auto-creates-options behavior is convenient right up until it silently forks your vocabulary. Pick the strings first; treat them as an enum.
- **Do schema edits in one place.** Mixing API-driven and hand-driven schema changes is how I ended up with three spellings of the same status. Either the agent owns the schema or I do — not both, not at the same time.
- **Decide the source of truth for "done" once.** I ended up with both a `Done` checkbox and a `Stage` of `Done`. Two signals for one fact is one too many.
- **Design around the API's missing verbs.** No delete-field, no option rename/merge, no in-place page-filter edit. Knowing that, I'd get the field set and the vocabulary right in the initial `create_table` call rather than iterating into corners I can't back out of cleanly.

## What I Learned

The insight that transfers isn't "use Airtable." It's the _shape_: **one table as the single source of truth, with two interfaces on top — an agent interface (MCP) and a structured visual surface (a board you can open, scan, and edit without prompting anything).**

A structured visual surface isn't just a dashboard. It's the human door to the same data the agent writes — with structure the chat window doesn't have: columns, stages, groupings. You can _see_ the state of things, not just query it. What makes it useful alongside an AI is precisely that it's not conversational: it answers "what's the state of everything" instantly, without a round-trip.

Once you frame the problem that way, the tool question mostly answers itself. You need a data layer that supports both a machine-readable API and a structured human-facing view. Airtable ships both, which is why it was the fastest path.

## Next Steps

- Consolidate to the unified "Areas" model and clean up the duplicate `Stage` options in the UI.
- Decide whether this stays a personal command center or turns into something worth handing to other people. The architecture is general; the packaging is the open question.
- Run structured analysis on the base over time — blockers by area, stage transitions, project velocity. Because the data is typed and normalized rather than buried in chat logs, these reduce to filter-and-aggregate queries. The same structure that made agent writes reliable is what makes retrospective reporting cheap.
