---
title: "Adding Stripe Subscriptions to a Phoenix/LiveView App: Lessons from CloudNori"
description: "A deep dive into integrating Stripe subscription billing with Phoenix/Elixir, including webhook handling, rate limiting, and the mistakes I made along the way."
pubDate: 2026-01-25
tags: ["building-in-public", "engineering", "elixir", "phoenix", "liveview", "stripe"]
draft: false
generatedBy: "agent"
---

I recently added Stripe subscription billing to [CloudNori](/projects/cloudnori), an anti-fragility stock screener built with Phoenix and LiveView. The application screens stocks for survival characteristics rather than chasing growth narratives—inspired by Nassim Taleb's work on antifragility. You can try it live at [cloudnori.com](https://cloudnori.com).

The goal was simple: monetize through tiered subscriptions that grant users different daily limits on screeners and stock discovery runs. The implementation taught me several lessons about config management, LiveView hooks, and webhook idempotency.

## The Plan

I needed three tiers: Free ($0), Basic ($29.99/mo), and Pro ($99.99/mo). Each tier would have different daily limits for stock screeners and discovery runs. I also wanted Stripe Checkout for payments, Customer Portal for self-service billing, webhook handling for subscription lifecycle events, and an admin dashboard for monitoring.

I broke the work into eight phases:

1. **Database & Schema** - Add subscription fields to users
2. **Billing Context** - Create the core billing module with limits and Stripe integration
3. **Webhook Controller** - Handle Stripe events securely
4. **Rate Limiting** - Replace hardcoded limits with tier-aware logic
5. **LiveView Pages** - Build subscription management UI
6. **Admin Dashboard** - Visibility into subscriptions and webhooks
7. **Configuration** - Wire up environment variables properly
8. **UI Polish** - Show tier badges and usage indicators

## Database Design

I added subscription fields to the User schema: admin status, subscription tier, Stripe customer ID, subscription ID, status, period end date, and cancellation flags. This gives me everything needed to check a user's subscription state without calling Stripe's API.

I also created a WebhookEvent table for idempotency. Each Stripe webhook has a unique event ID. Before processing, I check if we've seen it before. If yes, skip. This prevents double-charging or race conditions when Stripe retries webhooks.

## The Billing Context

The Billing module became the central hub for subscription logic. It defines limits for each tier (Free: 5 screeners/2 discoveries, Basic: 15/10, Pro: 50/25) and provides functions to check a user's limits based on their tier.

Admin users automatically get Pro limits regardless of their actual subscription. This let me test the full experience without paying myself.

For Stripe integration, the module handles creating checkout sessions, customer portal sessions, and syncing subscription data from webhooks. I put the user ID and tier in both checkout session metadata AND subscription metadata—this redundancy saved me later when webhooks arrived with inconsistent data structures.

## Webhook Handling

Webhooks are how Stripe tells your app about subscription events. The controller verifies signatures, checks for duplicate events, processes the event, and returns 200 quickly (Stripe times out after 30 seconds).

I handle four event types:

- **checkout.session.completed** - User completes payment, activate subscription
- **customer.subscription.updated** - Subscription changes (upgraded, cancelled, etc.)
- **customer.subscription.deleted** - Subscription ends, downgrade to free
- **invoice.payment_failed** - Log for manual follow-up

Each webhook gets marked as "processed" or "failed" with error messages. This made debugging much easier in the admin dashboard.

## Tier-Aware Rate Limiting

Originally, my Screenings and Discovery contexts had hardcoded daily limits. I replaced these with calls to the Billing context that look up the user's tier and return the appropriate limit.

Now when users upgrade, their limits immediately reflect their new tier. The LiveViews already had the user struct in assigns, so this was a drop-in change.

## LiveView Subscription Pages

I created three LiveView modules: a Plans page showing pricing with upgrade buttons, a Subscription management page displaying current plan and linking to Customer Portal, and a Success page for post-checkout confirmation.

The Plans page triggers Stripe Checkout on button click, redirecting users to Stripe's hosted payment page. After payment, Stripe redirects back to the success page. For billing management, I redirect to Stripe's Customer Portal—they handle card updates, invoice history, and cancellation flows. I don't need to build any of that UI or worry about PCI compliance.

## Admin Dashboard

I built an admin dashboard with three views: an overview with subscription stats, user management with tier and usage info, and a webhook event viewer for debugging.

The webhook viewer was invaluable. I could see which events succeeded, which failed, and read the error messages. When testing, I intentionally broke things to see how the system logged failures.

## The Configuration Mistake

This is where I made my biggest mistake.

I initially used compile-time configuration for Stripe price IDs. The problem: `Application.compile_env` reads values at compile time. When I set environment variables in `runtime.exs`, they were ignored. My app kept using placeholder values from the original compilation.

The fix was using `Application.get_env` in a function called at runtime instead of a module attribute set at compile time. This reads environment variables when the app starts, not when it compiles.

**The lesson:** Use compile-time config for constants that never change. Use runtime config for secrets and environment-specific values. If you're deploying to Fly.io or similar platforms, you probably want runtime config for most things.

## UI Updates

I added tier badges throughout the app and usage indicators in the screener and discovery pages. Users now see their limits and get nudged to upgrade when they hit the cap.

## Mistakes I Made

### Missing `on_mount` Hooks

My first attempt at subscription LiveViews crashed because I forgot to add the authentication hook. The `on_mount` hook loads the current user into socket assigns. Without it, `socket.assigns.current_user` doesn't exist.

For admin pages, I needed two hooks: one to load the user, and one to check admin status. Order matters—you can't check admin status before the user is loaded.

### Testing Pure Functions

I wanted to test the Billing module's pure functions without database overhead. Functions like "get user limits" don't touch the database—they're just logic on a struct. I switched from DataCase to plain ExUnit.Case and tests now run in milliseconds.

## Key Lessons

**Stripe's metadata is your friend.** Put everything you might need in metadata. I stored user ID and tier in multiple places, giving me fallback options when Stripe's data structure varied by event type.

**Idempotency is not optional.** Without duplicate detection, webhooks would cause users to be charged twice, subscription states flip-flopping, and race conditions during network retries. Always implement idempotency for webhooks.

**Test subscription flows end-to-end.** I used Stripe's test mode extensively with test card numbers. Key scenarios: new subscriptions, upgrades, cancellations, payment failures, and users with multiple tabs open causing out-of-order webhooks.

**Admin dashboards are force multipliers.** The 30 minutes I spent building the admin dashboard saved hours of debugging. Being able to see who's subscribed, which webhooks failed, and user activity patterns made me confident the system was working.

**LiveView makes subscriptions easy.** When a webhook updates the user's tier, the next page load reflects the new limits immediately. No polling, cache invalidation, or client-side state management needed.

## What I'd Do Differently

If I were starting over, I'd build the admin dashboard first. Having visibility into the system from day one would have caught issues earlier.

I'd also implement better error messages for users. Right now, if Stripe isn't configured, users see a generic error. I should explain what went wrong and what they can do about it.

## Closing Thoughts

Adding Stripe to Phoenix/LiveView was easier than expected once I understood the configuration model. The hardest parts were understanding compile-time vs runtime config, handling Stripe's inconsistent data structures in webhooks, and remembering to add `on_mount` hooks to every protected LiveView.

But the payoff is worth it. CloudNori now has a sustainable revenue model, and I can focus on building features instead of worrying about API costs.

If you're building a Phoenix app and considering subscriptions, I recommend using `stripity_stripe` for the Stripe SDK, always validating webhook signatures, implementing idempotency with a database table, putting user ID in all Stripe metadata, testing extensively with Stripe's test mode, and building an admin dashboard early.

Good luck, and may your webhooks always arrive in order.

---

_If you're interested in anti-fragility screening for stocks, check out [CloudNori](https://cloudnori.com). Read more about the project [here](/projects/cloudnori)._
