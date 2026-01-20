---
title: "Lidger: From Rails + React to Phoenix LiveView"
description: "Why I rebuilt my personal dashboard from a separate Rails API and React frontend into a unified Phoenix LiveView application, and how it's transformed my development speed."
pubDate: 2026-01-19
tags: ["elixir", "phoenix", "liveview", "rails", "react", "architecture", "lidger"]
draft: false
generatedBy: "human+ai"
---

## The Old Architecture

Lidger started as two separate repositories:

**LidgerV2** - A Rails 6 API backend:
- GraphQL API with 29 mutations and 22 type definitions
- Sidekiq for background jobs
- Redis for caching
- Complex token-based authentication with encrypted tokens
- Separate directories for models, controllers, services, GraphQL types, mutations, inputs...

**Lidgerfe** - A React frontend:
- 99 JavaScript/JSX files
- Apollo Client for GraphQL communication
- Redux for auth and flash messages
- Formik + Yup for form validation
- TailwindCSS + Styled Components (hybrid styling)
- Separate directories for components, queries, mutations, reducers, actions...

Two repos. Two deployment pipelines. Two sets of dependencies to maintain. Every feature required changes in both places.

## The Pain Points

### Context Switching Tax

Adding a simple feature like "mark a task complete" meant:

1. Write the GraphQL mutation in Rails
2. Define the input type
3. Update the GraphQL schema
4. Switch to the frontend repo
5. Write the GraphQL mutation query
6. Create a React component
7. Wire up Apollo's useMutation hook
8. Handle loading/error states
9. Update the cache or refetch queries

That's a lot of ceremony for toggling a boolean.

### The Serialization Dance

Everything had to be serialized to JSON, sent over HTTP, and deserialized on the other side. State lived in two places - the database and the React component. Keeping them in sync required careful cache management or aggressive refetching.

### Deployment Complexity

Two repos meant two CI pipelines, two hosting configurations, CORS headers to configure, API versioning to consider, and twice the dependency updates.

## Why Phoenix LiveView?

I'd been curious about Elixir for a while. The LiveView pitch is compelling: server-rendered HTML with real-time updates, no JavaScript required for interactivity. One codebase. One deployment.

### What I Gained

**Single Directory, Single Mental Model**

My entire application now lives in one place:
- `lib/lidger/` - Business logic (contexts)
- `lib/lidger_web/live/` - LiveView modules
- `lib/lidger_web/components/` - Reusable UI components

A feature like "mark task complete" is now:
1. Add a `handle_event` in the LiveView
2. Call the context function
3. Done. The UI updates automatically.

**No API Layer**

There's no serialization. No GraphQL schema to maintain. No cache invalidation strategy. The LiveView holds the state, and when it changes, the diff is sent to the browser automatically.

**Ecto is a Joy**

Coming from ActiveRecord, Ecto's explicit changesets felt verbose at first. Now I appreciate how they make data flow obvious. No magic callbacks firing unexpectedly.

**Real-time by Default**

PubSub is built in. Want to sync state across browser tabs? That's a few lines of code, not a whole WebSocket infrastructure project.

## The LLM Advantage

Here's something I didn't anticipate: **AI coding assistants work dramatically better with a unified codebase.**

With the old setup, Claude Code had to:
- Understand the Rails API structure
- Understand the React frontend structure
- Know how GraphQL connected them
- Make coordinated changes across two repos
- Keep track of which repo it was working in

Now, everything is in one place. When I ask Claude Code to add a feature, it can:
- Read the existing LiveView
- See the template right there
- Understand the context module
- Make all the changes in one pass

The context window isn't split across two architectural paradigms. The AI can see the full picture.

### Practical Example

Old way - "Add a delete button to tasks":
```
# In Rails (LidgerV2)
- Create DeleteTask mutation
- Add to MutationType
- Write specs

# In React (lidgerfe)
- Write DELETE_TASK GraphQL mutation
- Create DeleteButton component
- Wire up useMutation
- Handle optimistic updates
- Add confirmation modal
```

New way - "Add a delete button to tasks":
```elixir
# In the LiveView
def handle_event("delete_task", %{"id" => id}, socket) do
  Tasks.delete_task(id)
  {:noreply, stream_delete(socket, :tasks, %{id: id})}
end

# In the template
<button phx-click="delete_task" phx-value-id={task.id}>Delete</button>
```

The AI sees one file, one paradigm, one way of doing things.

## What I Miss

It's not all roses:

- **React's component ecosystem** - There's no LiveView equivalent of the React component library ecosystem
- **Offline support** - LiveView requires a connection. For a personal dashboard I use at home, this doesn't matter. For other apps, it might.
- **JavaScript when you need it** - Sometimes you want client-side interactivity.

## The Numbers

Rough comparison of the codebases:

| Metric | Rails + React | Phoenix LiveView |
|--------|---------------|------------------|
| Repositories | 2 | 1 |
| Total files | ~150 | ~40 |
| Dependencies | 80+ npm, 40+ gems | ~20 hex packages |
| Deploy targets | 2 (API + static) | 1 |
| Time to add simple feature | 30-60 min | 5-15 min |

## Should You Do This?

If you're building a personal project or internal tool where:
- Real-time updates are valuable
- You don't need offline support
- You want to move fast with fewer moving parts
- You're using AI coding assistants

Phoenix LiveView is worth serious consideration.

The shift from "coordinate two applications" to "build one application" changed how I think about features. Ideas that felt like "too much work" in the old architecture are now afternoon projects.

Lidger is finally the tool I wanted to build. And I'm building it faster than ever.
