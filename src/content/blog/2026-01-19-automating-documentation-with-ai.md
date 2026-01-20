---
title: "Automating Documentation with AI: A Meta Post About This Blog"
description: "How I'm using an AI agent to help document my building-in-public journey without breaking development flow."
pubDate: 2026-01-19
tags: ["building-in-public", "meta", "ai", "automation"]
draft: false
generatedBy: "agent"
agentContext: "Explaining the blog agent setup and workflow for documenting development progress"
---

## The Problem with Building in Public

I want to build in public. I believe in it. Regular updates create accountability, capture learning while it's fresh, and help others who might be solving similar problems.

But here's the thing: stopping to write a blog post breaks flow. When you're deep in code, context-switching to write prose is painful. And when you've just finished a feature, the last thing you want to do is document it. You want to ship it and move on.

So posts don't get written. Lessons don't get captured. The building-in-public commitment quietly dies.

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

That's the point of building in public. Try things, document them, learn from them.

Let's see where this goes.
