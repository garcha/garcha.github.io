---
title: "How Effective Dev Teams Produce Quality Work"
description: "Lessons from building a food truck catering marketplace in a single session: why decisions made upfront compound, and how small feedback loops keep teams moving."
pubDate: 2026-04-16
tags: ["building-in-public", "engineering", "foodatruck", "product"]
draft: false
generatedBy: "agent"
agentContext: "Written from the context of a full build session for FoodaTruck — an LA food truck catering marketplace. The session covered competitor scraping, build planning, Astro marketing site, Phoenix/LiveView admin backend, API wiring, bug fixes, and applying the Tailwind Plus Salient design system across both stacks."
---

## Context

We built FoodaTruck in a single session. Starting from nothing, the session covered: scraping a competitor site, writing a build plan, scaffolding an Astro marketing site, building a Phoenix/LiveView admin backend, wiring up API endpoints, fixing bugs, and applying a coherent design system across both the public site and the admin panel.

That is a lot of surface area. The fact that it held together says something not about speed for its own sake, but about a small set of decisions made early that prevented an entire class of problems later.

This post is about what those decisions were and why they worked.

---

## Constraints

The team is small: one engineer writing code, a marketing lead, an SEO specialist, and a junior developer. The business model is commission-based and unproven. The directive was to prove demand before building anything complex.

That last constraint is the most important one. It eliminates entire categories of premature work. You are not building a matching algorithm. You are not building a payments system. You are building the smallest possible surface that lets real customers submit requests and lets real vendors apply. Everything else is noise until you have evidence it matters.

Time pressure was real but not artificial. The faster you get a working form in front of customers, the faster you find out whether the business exists.

---

## Options Considered

**Option 1: Start with the database schema and build up.**
This is the instinct of many backend engineers. Decide the data model, generate migrations, then figure out the frontend. The problem is that you end up spending hours on infrastructure for a product whose user-facing surface you have not validated. The schema might be perfect and the pages might be wrong.

**Option 2: Start with the user-facing pages, reference a real competitor, and derive the schema from what the forms actually need.**
This is what we did. We scraped SacToMoFo first. We read their catering request form, their vendor application, their FAQ, their pricing language. We extracted field names, guard rails, trust signals, and content structure. Then we wrote a build plan grounded in that evidence.

The competitor scrape was not optional background research. It was the foundation. It told us the booking minimum ($1,000/truck), the service models (open sales, open tab, voucher), the vendor requirements (state seller's permit, three months minimum operation, 360 video), and the 17-question FAQ that earns SEO trust for corporate catering queries. None of that had to be invented. It existed in the market. We just had to read it carefully and adapt it for LA.

**Option 3: Pick a design system and customize it mid-build.**
We did not do this. The Tailwind Plus Salient template was selected before a single page was written, and a style guide was produced from it before the Astro project was scaffolded. That document defined fonts, colors, button shapes, badge colors, heading classes, layout patterns, and the differences between public-site components and admin components.

The alternative would have been to style things as we went. That path always produces the same result: two months of accumulated visual debt, a dark mode that never ships, a button component with four slightly different border radii, and a junior developer who cannot tell which pattern is canonical.

---

## Decision

Three structural decisions drove everything else.

**First: reference material before original work.** The competitor scrape removed ambiguity about what the product needed to be. It grounded every subsequent decision in something concrete and validated by a market that already exists.

**Second: write the style guide before writing any UI.** One document, shared across both the Astro site and the Phoenix admin, defined exactly how every visual element should behave. When a badge needed a status color, the answer was in the guide. When the admin sidebar needed a width, the answer was in the guide. No one had to make a judgment call in the moment. The judgment call had already been made, once, with intention.

**Third: make the MVP genuinely minimal.** The events page was explicitly deferred because it is useless without active vendor schedules. Programmatic SEO was deferred to Wave 2. The matching algorithm, payments, and vendor automation were deferred until manual operations became painful enough to justify them. Every deferred item was a decision, not an omission. The build plan said explicitly: build this only when the pain is proven.

---

## Outcome

By the end of the session, both the marketing site and the admin backend were coherent. Forms worked. Data flowed. The admin panel showed booking requests with correct status badges, vendor detail views with the right information hierarchy, and a dashboard with stats. The public site had a homepage, a corporate catering page with the full 17-question FAQ, a booking form with the exact field structure derived from the competitor analysis, a vendor application form, and a thank-you page.

None of it was perfect. There were bugs. A CSS variable was shadowed in the wrong layer. A LiveView component rendered the wrong badge color for one status. These were fixed quickly, in place, without ceremony. That is the point. Small feedback loops at the component level are orders of magnitude cheaper than discovering the same problem at integration time.

The outcome was not a finished product. It was a working foundation with real data flowing through real forms, styled consistently across two different technology stacks, built fast enough that the business can start proving demand before anyone has written a single line of automation.

---

## What I'd Change

The one place where friction accumulated was at the boundary between the Astro frontend and the Phoenix API. The API routes were defined in the build plan but the endpoint contracts were not specified early enough. Field names in the form did not always match the schema field names cleanly on the first pass. This is a small thing but it is exactly the kind of thing that a lightweight shared contract document would eliminate. Even a half-page markdown file listing every POST body and its expected keys would have saved several back-and-forth corrections.

The other thing worth revisiting: the style guide covers components well but says almost nothing about error states. Form validation messages, empty states in the admin list views, and error banners all had to be improvised. That improvisation produced acceptable results, but acceptable is not the same as coherent. A small section in the style guide covering error and empty states would have closed that gap.

---

## What I Learned

The leverage in a session like this does not come from typing faster. It comes from the quality of the decisions that were made before any code was written.

Choosing a design system early and writing it down in a shared document costs maybe two hours. It saves that cost back on every component you build after, because no decision needs to be re-litigated. Scraping a competitor before writing a single route costs maybe four hours. It saves that cost back because your form fields match what the market expects, your FAQ answers the questions real customers ask, and your guard rails match the economic reality of the business.

The feedback loop that matters most is not CI/CD or test coverage or deployment speed. It is the loop between decision and consequence. If you make a structural decision early and it is wrong, you pay compound interest on that mistake for the life of the project. If you make it right, you get compound interest in the other direction.

Write the style guide. Read the competitor. Define the scope limit. Then build.
