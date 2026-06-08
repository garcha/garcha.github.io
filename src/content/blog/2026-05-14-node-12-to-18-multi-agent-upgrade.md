---
title: "Upgrading a Legacy React Widget from Node 12 to 18 with Multi-Agent Claude"
description: "How running three specialized AI agents — Lead, Frontend Dev, and QA — turned a tedious Node version migration into a focused, fast, and surprisingly painless process."
pubDate: 2026-05-14
tags: ["building-in-public", "engineering", "ai-agents", "node-upgrade", "react"]
draft: false
generatedBy: "agent-edited"
image: "/images/blog/multi_agent.png"
agentContext: "Agent Teams: Benefits and how to use them"
---

## Context

The project was an internal React 15 widget — a small, self-contained UI component embedded across several properties. It had been sitting on Node 12 for a while — not because anyone chose to keep it there, but because nobody wanted to touch it. It worked. The toolchain was old (Babel 6, webpack 2, node-sass, Jest 20, Enzyme 2), and upgrading any one piece risks pulling on a thread that unravels everything else.

## Original Plan

The goal was conservative: get the project building and all tests passing on Node 18 without touching the browser runtime dependencies. React 15, MobX 3, webpack 2, and styled-components 2 were explicitly out of scope. Those aren't Node 18 blockers — they're a separate conversation. The focus was purely on the build and test toolchain.

The rough plan:

1. Improve test coverage — the project was sitting at roughly 30%, which wasn't enough confidence to change anything safely
2. Identify which dependencies would break under Node 18
3. Update only what needed updating
4. Verify the build compiles, tests pass, and manually test that the widget still works correctly

Simple enough in principle. In practice, a Node version bump on a 2017-era JS project means touching Babel, Sass, Jest, Enzyme, ESLint, and their entire dependency graphs — often with conflicting peer dependency requirements.

## The Multi-Agent Approach

Rather than having a single agent (or a single developer) context-switch between strategy, implementation, and verification, the work was split across three specialized Claude Code agents in a pair-programming style setup. Only one agent — the Frontend Developer — was the driver, making actual changes to the codebase. The other two acted as navigators, guiding decisions and verifying results without touching files directly.

**Lead Agent (Navigator)** — Owned the migration strategy. Figured out what needed to change and what could stay. Identified that `node-sass` was the most likely source of pain (it's a native module that fails to build on newer Node versions), flagged Babel 6 as another hard blocker, and decided which package version targets to aim for. Coordinated handoffs between the other agents.

**Frontend Developer Agent (Driver)** — The only agent making changes. Updated `package.json`, rewrote `.babelrc`, created the Enzyme adapter setup file, adjusted webpack config where needed. Did the actual mechanical work of swapping packages and wiring things together.

**QA Agent (Navigator)** — Ran the build, ran the tests, and reported back what broke. This is where the real value showed up. The QA agent caught two non-obvious issues that would have taken a developer significant time to diagnose manually.

## How to Set This Up

Agent teams are an experimental feature in [Claude Code](https://code.claude.com/docs/en/agent-teams). To enable them, add `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` to your `settings.json`:

```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

From there, you describe the team structure in natural language. For this migration, something like:

```
Create an agent team for a Node 12 to 18 migration. Spawn three teammates:
- A lead (navigator) to own migration strategy and coordinate handoffs — read-only, no file changes
- A frontend dev (driver) to execute package upgrades and config changes — the only agent that writes code
- A QA agent (navigator) to run builds, run tests, and report what breaks — read-only
```

Claude spawns each teammate as a separate session with its own context window. They communicate through a shared task list and direct messaging — the lead guides strategy, the QA agent reports failures directly to the dev, and only the dev agent makes changes. You can message any teammate directly using `Shift+Down` to cycle between them.

The key difference from subagents (which run inside a single session) is that teammates can talk to each other. That's what made the pair-programming model work — the QA agent reported a failing test to the dev agent, the dev fixed it, and QA re-verified, all as a structured handoff rather than one person context-switching between roles.

## What Changed

The core changes fell into a few categories:

**Sass toolchain replacement.** `node-sass` and `node-sass-chokidar` were removed entirely and replaced with `sass` (Dart Sass) at `^1.86.1`, with `sass-loader` bumped from 6.0.5 to 7.3.1. Dart Sass is pure JavaScript — no native compilation, no Node version dependency. This also meant the `build-css` and `watch-css` npm scripts could be deleted; webpack's `sass-loader` handles it all now.

**Babel 6 to Babel 7.** The full migration: `@babel/core`, `@babel/preset-env`, `@babel/preset-react`, the decorators plugin (the project uses MobX decorators), and `babel-loader` bumped from 7.0.0 to 8.2.3. The `.babelrc` format changed enough that this required rewriting the config, not just version bumping.

**Jest 20 to 27, Enzyme 2 to 3.** Jest 27 has much better compatibility with modern Node. Enzyme 3 requires an adapter to be explicitly registered — that's a new setup file that didn't exist in Enzyme 2.

**ESLint 3 to 4.** Minor bump, but required for Node 18 compatibility.

**Lodash added as an explicit dependency.** It was already being used in the project but only as a transitive dependency through something else. When dependency trees shift, transitive deps can disappear. Made it explicit.

## Iterations and Fixes

Two issues came up during QA that weren't anticipated in the original plan.

**Cheerio/Enzyme incompatibility.** Enzyme 3's peer dependencies pulled in a version of `cheerio` that conflicted with what Enzyme actually expected at runtime. The fix was to add a `resolutions` entry in `package.json` pinning `cheerio` to `1.0.0-rc.3`. This is the kind of thing that fails silently or with a cryptic error — the QA agent surfaced it by running the test suite and tracing the failure back to its source.

**Babel config conflicts.** With Babel 7, there are more ways to configure things, and some plugin option names changed. The initial `.babelrc` rewrite had a flag that Babel 7 no longer accepted in that position. The QA agent caught the build error, the Frontend Dev agent fixed the config, and the QA agent verified the fix. That navigator-to-driver feedback loop — which would normally be a developer switching contexts mentally — happened as a structured handoff.

## Final State

- Test coverage improved from ~30% to over 80% before the migration began, then reached 90.78% by the end
- Build compiles successfully, output is 123 KB gzipped
- 42/42 tests passing
- Manual testing confirmed the widget renders and behaves correctly in its host pages
- Node 18 compatible

The browser runtime deps (React 15, MobX 3, webpack 2) are unchanged, as planned.

## What I Learned

**The driver/navigator split reduces cognitive overhead.** The biggest practical benefit of the multi-agent setup wasn't raw speed — it was that each agent stayed in its lane. The Lead navigated strategy without getting bogged down in Babel config syntax. The Frontend Dev drove changes without having to mentally track whether the build was passing. The QA agent verified results without second-guessing whether a change was intentional. Only one agent owned the code — the others guided and checked.

**QA as a first-class role matters.** In solo developer workflows (and in single-agent AI workflows), testing is often the last thing that gets attention. When a separate agent owns verification, it runs earlier and more thoroughly. The cheerio pin and the Babel config issue were both found before the "it's done" declaration, not after.

**Old toolchains have predictable failure modes.** Node-sass breaking on new Node versions, Babel 6 being incompatible, Enzyme needing explicit adapters in v3 — none of this was surprising once you know what to look for. The hard part isn't knowing the fixes; it's having the patience to methodically work through all of them without missing one. Agents are good at methodical.

**Conservative scope works.** Deciding upfront not to touch React 15 or webpack 2 made the task bounded. There's a temptation when you're already in a project's guts to upgrade everything. Resisting that kept the migration from ballooning into a multi-week rewrite.

## Next Steps

The obvious candidates for future work:

- Webpack 2 to 5 — the next significant toolchain modernization
- React 15 to 18 — a bigger lift, but the toolchain is now in a state where it's feasible
- ESLint 4 to 8+ with a modern config format

None of those are urgent. Node 18 compatibility was the goal, and it's done.
