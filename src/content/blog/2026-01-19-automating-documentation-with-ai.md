---
title: "How I Built an AI Agent to Automatically Write My Engineering Blog Posts"
description: "Here's how I built an AI-driven workflow to automatically generate developer documentation without interrupting coding flow."
pubDate: 2026-01-19
tags: ["engineering", "meta", "ai", "automation"]
draft: false
generatedBy: "agent"
agentContext: "Explaining the blog agent setup and workflow for documenting development progress"
---

## The Real Problem: Writing Is Work

Shipping code already consumes the scarce resource: focused time. Writing about that code is a second job layered on top of the first. It means reopening mental context, reconstructing decisions, and translating half-formed engineering thoughts into clean prose. That cost is real.

The result is predictable:
- You finish a feature.
- You tell yourself you'll write about it later.
- "Later" never comes.

Not because you don't care—but because documentation competes directly with momentum. Every post requires a full context switch. Every context switch drains energy. Over time, the habit collapses.

What I actually wanted was this:
- Stay in flow while building.
- Capture intent and decisions as they happen.
- Let something else do the slow, mechanical work of turning that into words.

LLMs are good at exactly that: summarizing messy, in-progress thinking into coherent narrative. The goal wasn't "write for me." The goal was to remove the tax that writing imposes on building.

So I stopped treating documentation as a separate task—and built a system where it's a byproduct of the work itself.

## The Solution: An AI Agent That Writes Blog Posts

Instead of writing blog posts manually, I set up an AI agent that can do it for me. Not in a lazy, low-quality way - but as a tool to capture the story of the work while it's still fresh.

Here's how it works.

## The Setup

This website is built with Astro and uses content collections. Blog posts are markdown files in `src/content/blog/` with a structured frontmatter schema defined in `src/content/config.ts`.

The schema includes standard fields like title, description, pubDate, and tags. But I added two important fields for this workflow:

- **generatedBy**: Either 'human' or 'agent' - makes it transparent which posts were written by me vs. the AI
- **agentContext**: An optional note about what prompted the agent to write the post

## The Workflow

When I'm working on something worth sharing, I invoke the blog agent through Claude Code (Anthropic's CLI). The agent has access to the entire conversation - it can see what I was trying to build, what problems I hit, and how things evolved.

I give it context about what I think is worth documenting, and it:

1. Reads the conversation history to understand the work
2. Extracts the story: the goal, the approach, what went wrong, what changed
3. Writes a blog post in first person, in my voice, focused on process and learning
4. Saves it to the correct location with proper frontmatter
5. Marks it as `generatedBy: "agent"` for transparency

The agent doesn't write marketing copy or hype. It writes honest engineering logs - what I was trying to do, what assumptions I made, where things broke, what I learned.

## The Prompt

Here's the actual prompt I use to guide the agent:

```
You are a documentation and narrative agent embedded inside a development workflow.

Your job is to:

Read the full conversation between the primary LLM and the user.

Extract the story of the work:

What was the original goal?

What approach was planned?

What assumptions were made?

What problems or edge cases emerged?

What corrections, pivots, or refinements happened?

What was learned about the problem, the domain, or the implementation?

Produce a clear, chronological blog-style post that:

Summarizes the intent of the project or feature.

Describes how it was originally designed.

Highlights mistakes, friction, and course-corrections.

Captures insights, tradeoffs, and lessons learned.

Reads like a thoughtful engineering log, not marketing copy.

Is written in plain, direct language for other builders.

Writing style:

First-person ("I") or neutral engineering voice.

Honest about uncertainty, missteps, and iteration.

Focused on process and learning, not just outcomes.

Concrete and technical where appropriate.

No fluff. No hype.

Output format:

Markdown compatible with Astro.

Title at the top.

Use clear sections such as:

Context

Original Plan

What Changed

Iterations & Fixes

What I Learned

Next Steps
```

The prompt is deliberately opinionated about style. I want engineering logs, not marketing. I want honesty about mistakes, not just polished outcomes.

## Why This Approach Works

**It preserves flow.** I don't have to context-switch out of coding to write. The documentation happens after, when I choose to invoke it.

**It captures the actual story.** The agent has access to the full conversation, including the mistakes, the dead ends, the course corrections. It can document the real process, not just the polished outcome.

**It's transparent.** Every post is marked with who wrote it. Readers know when they're reading agent-generated content.

**It's iterative.** If the first draft isn't quite right, I can refine it. The agent learns from the conversation, not from guessing.

## The Tools

The current stack:

- **Claude Code** - Anthropic's CLI for invoking Claude as a development agent
- **Astro** - Static site generator with content collections
- **Tailwind CSS** - For styling
- **GitHub Pages** - Hosting
- **GitHub Actions** - Automated deployment

## What I'm Learning

This is a meta experiment. I'm using AI not to replace writing, but to reduce the friction that prevents writing from happening at all.

The posts the agent writes aren't perfect. But they're better than the posts I *don't* write because I'm too tired or busy.

The key is treating the agent as a tool, not a replacement. I provide the context, the judgment about what's worth sharing, and the editorial oversight. The agent provides the structure and the prose.

## This Post

This post itself was written by the agent. I told it to explain how the blog agent works, gave it the technical context about the setup, and asked it to write in first person.

You're reading the output. Meta enough for you?

## Next Steps

I'll keep refining this workflow as I use it. Maybe I'll add more structure to the agent prompts. Maybe I'll build a better interface for invoking it. Maybe I'll discover this whole thing is a terrible idea.

Let's see where this goes.
