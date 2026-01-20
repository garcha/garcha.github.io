---
title: "Migrating My Portfolio from Static HTML to Astro"
description: "How I rebuilt my engineering portfolio using Astro, content collections, and modern tooling - while learning what matters in a developer site."
pubDate: 2026-01-19
tags: ["building-in-public", "engineering", "astro", "web-development"]
draft: false
generatedBy: "agent"
---

## Context

For years, my portfolio lived as a single-page HTML site. It worked - clean design, fast loading, easy to deploy to GitHub Pages. But it had grown stale. The last meaningful update was in 2023, and the technical content didn't reflect what I'd been building recently.

More importantly, I wanted to start building in public. That meant adding a blog and a proper projects section. Editing raw HTML for blog posts wasn't going to cut it.

## Original Plan

The goal was straightforward: migrate to a modern framework that would make content management easier while keeping what worked about the old site.

Requirements:
- Fast, static site generation
- Simple content management for blog posts and projects
- Keep the existing design aesthetic
- Deploy to GitHub Pages without hassle
- Support for agent-authored content (I wanted to experiment with AI-assisted writing)

I chose Astro because it fit the brief: content-focused, ships minimal JavaScript, and has excellent DX for working with markdown. Plus, the content collections API looked like exactly what I needed.

## What Changed

The migration turned into a deeper rethink than I expected. As I pulled apart the old HTML, I realized some sections were unclear or didn't represent how I actually work.

### Major Additions

**Content Collections**
The biggest win was setting up two content collections - one for blog posts, one for projects. Each has its own schema enforced by Zod:

**Projects Section**
I documented three active projects:
- **White Label Reviews (ProspectWise)**: A reputation management platform built with Rails, React, and AWS Lambda
- **Idealeet**: An AI landing page generator using Elixir, Phoenix LiveView, and OpenAI
- **Lidger**: A personal life management dashboard with Rails and Hotwire

Each project page includes the problem, solution, tech stack, and current status. This gives context beyond just "here's what I built."

**Engineering Philosophy**
I added six cards describing how I think about software:
- Systems Over Tickets
- Clarity From Ambiguity
- Trade-offs Over Perfection
- Maintainability
- Reliability & Observability
- Economic Thinking

These replaced vague "I'm passionate about quality" statements. I wanted to be specific about the mental models I bring to engineering work.

### Technical Stack Decisions

**Astro + Tailwind CSS v4**
Astro handles the static generation, Tailwind handles styling. I upgraded to Tailwind v4 to try the new architecture - it's faster and the config is cleaner.

**GitHub Actions for Deployment**
Previously I was manually pushing to the gh-pages branch. Now it's automated: push to master, GitHub Actions builds the Astro site and deploys it. One less thing to remember.

**Typography Plugin**
Blog posts need good typography. The @tailwindcss/typography plugin handles that without me needing to write custom styles for every heading, list, and code block.

## Iterations & Fixes

**Component Structure**
I initially tried to keep everything in one massive Astro file. Bad idea. I broke the homepage into distinct components:
- Hero
- About (Engineering Philosophy)
- CoreExperience
- ValueProp
- CaseStudies (Projects)
- Leadership
- TechStack
- Education
- Contact

Each component is self-contained. Easier to reason about, easier to update.

**Content Organization**
The old site mixed content and presentation. Now all content lives in markdown files in `/src/content/`. Want to add a blog post? Drop a markdown file in the blog folder. Want to showcase a new project? Add it to the projects folder. The content schema enforces consistency.

**GitHub Presence**
I have two GitHub accounts - my personal one (garcha) and one I use for some projects (jazzgarcha). The old site only linked to one. Now both are accessible. Small fix, but it was an annoying omission.

**Claude Code Credit**
I used Claude Code extensively while building Idealeet and Lidger. It felt dishonest not to mention it in the tech stack. If you're going to build in public, be honest about your tools - including AI ones.

## What I Learned

**Static Site Generators Have Matured**
Astro's developer experience is genuinely good. Hot reload is instant, error messages are clear, and the mental model (components + content collections) maps cleanly to how I think about content sites.

**Content Schemas Are Worth It**
Enforcing a schema with Zod catches mistakes at build time. Forgot to add tags to a post? Build fails. Typo'd the project status field? Build fails. It's like types for your content.

**Less JavaScript Is Better**
The old site was static HTML. This new site is also mostly static HTML - Astro just makes it easier to manage. The final bundle is tiny because Astro doesn't ship the framework to the client. This approach still makes sense in 2026.

**Your Portfolio Should Reflect How You Actually Work**
The old site was generic. "Full-stack developer who cares about quality." Everyone says that. The new site is more opinionated. It shows the projects I'm building, explains the mental models I use, and documents the tools I actually reach for (Rails, Elixir, Claude Code).

**Building in Public Creates Clarity**
Writing about this migration forced me to articulate why I made certain choices. Why Astro? Why content collections? Why separate the engineering philosophy section? Having to explain decisions clarifies whether they were good decisions.

## Next Steps

The foundation is solid now. Next up:
- Write more blog posts documenting learning
- Keep iterating on the projects and writing about what I learn

The site is live at [jaspreetgarhca.com](https://jaspreetgarcha.com). The code is public. If you're building something similar and have questions, reach out.

Let's keep building.
