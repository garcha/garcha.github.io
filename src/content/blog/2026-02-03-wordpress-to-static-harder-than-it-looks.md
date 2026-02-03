---
title: "Converting WordPress to Static HTML is Harder Than It Looks"
description: "A journey through the hidden complexity of WordPress migrations, LLM limitations, and why sometimes the 'simple' solution isn't actually simpler."
pubDate: 2026-02-03
tags: ["building-in-public", "engineering", "wordpress", "static-sites"]
draft: false
generatedBy: "agent-edited"
---

## Context

I recently attempted to move a WordPress site to static hosting. A friend is closing her business down and wanted to preserve their business website. On paper, this seemed straightforward: WordPress generates HTML, so just save the pages as static files and deploy them. How hard could it be?

Turns out, pretty hard. And in the process, I learned something interesting about the limits of LLMs when dealing with complex CMS migrations.

## The Original Plan

The plan was simple:

1. Clone the WordPress site to static HTML/CSS
2. Deploy it to Surge (a static hosting service) for testing
3. Archive a friend's website for future access

This seemed like exactly the kind of task an LLM should excel at. It's well-documented, people do it all the time, and there are known tools and approaches. I figured I'd have it done in an afternoon.

## What Changed: Reality Meets WordPress

The static conversion appeared to work locally. I could browse the site, click through pages, everything looked fine. Victory, right?

Wrong.

When I tried to deploy to Surge, things fell apart. The classic "works on my machine" problem reared its head. What I didn't fully appreciate was just how much complexity WordPress hides under the hood:

**Dynamic Content Generation**
WordPress doesn't just serve static pages. It generates content on-the-fly based on URL parameters, query strings, and routing logic. A static site generator has to anticipate every possible page variation.

**Database-Driven Everything**
Pages, posts, comments, metadata—it's all in the database. Converting this to static files means you need to export every possible state and relationship.

**Theme Dependencies**
WordPress themes aren't just CSS templates. They're PHP code that decides what content to render, when, and how. Static HTML can't replicate that logic.

**Plugin Functionality**
Plugins hook into WordPress's execution pipeline. Forms, galleries, contact pages, SEO optimizations—all of this lives in PHP, not HTML.

**URL Structures and Routing**
WordPress's pretty permalinks rely on Apache/Nginx rewrite rules and PHP routing. Static hosting services have limited support for this kind of dynamic routing.

## Iterations and Fixes

I worked with Claude to try several approaches:

- Using wget to mirror the site (broken links, missing assets)
- Trying WordPress static site generator plugins (incomplete output)
- Manual HTML export and cleanup (tedious, error-prone)
- Debugging Surge deployment configurations (couldn't replicate WordPress routing)

Each attempt revealed another layer of WordPress complexity. The LLM could suggest approaches, but couldn't anticipate the specific edge cases in my particular WordPress setup. There were too many variables: theme customizations, plugin interactions, permalink structures, media library organization.

Eventually, I gave up on the static conversion entirely.

## The Actual Solution

In the end, I went back to running WordPress properly:

1. Used the **All-in-One WP Migration** plugin to create a complete backup
2. Spun up a DigitalOcean droplet with WordPress pre-installed
3. Restored the backup to the new server

Even this "straightforward" approach had friction. The backup file was too large for the default PHP upload limits. I had to SSH into the droplet and manually edit `php.ini`:

```ini
upload_max_filesize = 512M
post_max_size = 512M
```

Then restart Apache and try again. But it worked.

## What I Learned

**Sometimes the "simple" solution isn't actually simpler.**
Static sites are great for blogs built with static site generators from the ground up. But converting an existing WordPress site? That's retrofitting complexity, not reducing it.

**WordPress's complexity is invisible until you try to work around it.**
When WordPress works, it just works. You don't think about the database queries, the PHP execution, the plugin hooks. But try to escape that ecosystem, and you realize how much is happening behind the scenes.

**Running WordPress properly might be easier than escaping it.**
A managed WordPress host or a DigitalOcean droplet costs a few dollars a month. The time spent fighting with static conversion tools? Worth far more than that.

**LLMs can help with many coding tasks, but complex CMS migrations have too many edge cases.**
LLMs are excellent at explaining concepts, writing boilerplate code, and suggesting approaches. But WordPress migrations involve site-specific configurations, plugin quirks, theme customizations, and hosting environment differences. There are too many unknowns for an LLM to reliably navigate without iterative debugging—and even then, success isn't guaranteed.

## Next Steps

The site is now running on DigitalOcean with proper WordPress hosting. It's stable, performant, and I'm not fighting with deployment issues anymore. This proved the backup and restore works, and my friend can have her website back. There may be additional complexity when restoring it in the future as versions change with wordpress, php, themes, plugins, etc... we'll handle that when the website will actually be restored.

If I were starting from scratch, I'd use a static site generator like Astro, Hugo, or Eleventy. But for an existing WordPress site with years of content and customization? Sometimes the path of least resistance is just running WordPress properly.

The moral of the story: not every problem needs a clever solution. Sometimes the boring answer—running the software as intended—is the right one.
