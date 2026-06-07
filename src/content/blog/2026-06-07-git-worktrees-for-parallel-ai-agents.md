---
title: "Running Multiple AI Agents on the Same Repo with Git Worktrees"
description: "How git worktrees give each AI agent its own branch and directory, eliminating the file conflicts and clobbered state that happen when two agents share a working tree."
pubDate: 2026-06-07
tags: ["building-in-public", "engineering", "ai-agents", "fish-shell", "git-worktrees"]
draft: false
generatedBy: "agent"
---

## Context

If you run two AI coding agents: Claude Code, Cursor, Copilot Workspace, or anything else or on the same repository at the same time, things break in ways that are annoying to debug. One agent writes a file. The other agent reads a stale version of it, makes its own changes, and writes it back. You end up with a codebase that's a non-deterministic mix of both agents' outputs, and neither agent knows what happened.

The basic solution is to run them sequentially. That works, but it leaves performance on the table. The better solution is to give each agent its own isolated working environment. That's what git worktrees are for.

## What Git Worktrees Actually Are

A git worktree is a second (or third, or fourth) checkout of the same repository, linked to the same underlying object store, but with its own working directory and its own branch. You're not cloning. There's no duplication of the `.git` history or object database. Each worktree shares the same repo, but has a separate HEAD, a separate index, and a separate set of files on disk.

The practical effect — three directories, all checked out simultaneously:

- `project/` on `main`
- `project-feature-auth/` on `feature-auth`
- `project-bugfix-login/` on `bugfix-login`

Changes in one don't touch the others. Each can run its own dev server, its own test suite, its own agent session — independently and in parallel.

This is not a new feature. Git worktrees have been around since Git 2.5 (2015). They just don't get talked about much outside of specific workflows. AI agents are a workflow where they matter a lot.

## The Directory Layout

My preferred layout puts each worktree as a sibling of the main repo, named `<repo>-<branch>`:

```
~/projects/
    myapp/              ← main repo, on 'main' or 'develop'
    myapp-feature-auth/ ← worktree for Agent 1
    myapp-bugfix-login/ ← worktree for Agent 2
```

This is intentional. Keeping worktrees next to the main repo (rather than inside it or somewhere else entirely) makes them easy to find, easy to `cd` into, and easy to clean up. It also means that any tool or script that expects to find things relative to a project root still works correctly inside each worktree.

## The Fish Shell Wrapper

Running `git worktree add -b <branch> <path>` manually every time is tedious. I wrapped the common operations into a `gworktree` command in Fish:

- Each function lives in its own file under `~/.config/fish/functions/`
- Fish auto-loads every `.fish` file in that directory at startup

### The Dispatcher

`gworktree.fish` is a single entry point that routes subcommands to the appropriate function:

```fish
function gworktree
    if test (count $argv) -eq 0
        gworktree_help
        return 1
    end

    set command $argv[1]

    switch $command
        case -h --help help
            gworktree_help

        case ls list
            git worktree list

        case rm remove
            if test (count $argv) -lt 2
                echo "Usage: gworktree rm <branch>"
                return 1
            end
            gworktree_rm $argv[2]

        case cd
            if test (count $argv) -lt 2
                echo "Usage: gworktree cd <branch>"
                return 1
            end
            gworktree_cd $argv[2]

        case '*'
            gworktree_open $command
    end
end
```

**`case '*'`** is the key design choice — any unrecognized subcommand is treated as a branch name:

- `gworktree feature-auth` is a valid command; no separate `open` or `add` needed
- Worktree exists → opens it
- Worktree doesn't exist → creates it

### Creating or Switching to a Worktree

`gworktree_open.fish` does the heavier work. It derives the worktree path from the current repo root, then checks whether the branch and the directory already exist before deciding what git command to run:

```fish
function gworktree_open
    if test (count $argv) -eq 0
        echo "Usage: gworktree_open <branch>"
        return 1
    end

    set branch $argv[1]

    if not git rev-parse --is-inside-work-tree >/dev/null 2>&1
        echo "Not inside a git repository"
        return 1
    end

    set repo_root (git rev-parse --show-toplevel)
    set repo_name (basename $repo_root)
    set parent_dir (dirname $repo_root)
    set worktree_path "$parent_dir/$repo_name-$branch"

    if test -d $worktree_path
        echo "Worktree already exists: $worktree_path"
        cd $worktree_path
        return
    end

    git show-ref --verify --quiet refs/heads/$branch

    if test $status -eq 0
        echo "Adding worktree for existing branch: $branch"
        git worktree add $worktree_path $branch
    else
        echo "Creating branch and worktree: $branch"
        git worktree add -b $branch $worktree_path
    end

    if test $status -ne 0
        return 1
    end

    cd $worktree_path
end
```

**Path derivation** — three variables, always computed the same way:

- `repo_root` — from `git rev-parse --show-toplevel`
- `repo_name` — from `basename $repo_root`
- `parent_dir` — from `dirname $repo_root`
- `worktree_path` — `$parent_dir/$repo_name-$branch`

Because every function derives the path the same way, `gworktree_cd` and `gworktree_rm` know where to look without asking git.

**Branch detection** — one of two `git worktree add` forms depending on whether the branch already exists:

- Branch exists → `git worktree add <path> <branch>`
- Branch is new → `git worktree add -b <branch> <path>`

Either way, the function ends with `cd $worktree_path` so you land in the new directory immediately.

```
# new branch — creates it and the worktree, then cds in
gworktree feature-auth
# → Creating branch and worktree: feature-auth
# → (now in ~/projects/myapp-feature-auth)

# existing branch — attaches the worktree, then cds in
gworktree bugfix-login
# → Adding worktree for existing branch: bugfix-login
# → (now in ~/projects/myapp-bugfix-login)
```

### Navigating to an Existing Worktree

`gworktree_cd.fish` is simpler — it constructs the same path and changes to it if the directory exists:

```fish
function gworktree_cd
    if test (count $argv) -eq 0
        echo "Usage: gworktree cd <branch>"
        return 1
    end

    set branch $argv[1]

    if not git rev-parse --is-inside-work-tree >/dev/null 2>&1
        echo "Not inside a git repository"
        return 1
    end

    set repo_root (git rev-parse --show-toplevel)
    set repo_name (basename $repo_root)
    set parent_dir (dirname $repo_root)
    set worktree_path "$parent_dir/$repo_name-$branch"

    if test -d $worktree_path
        cd $worktree_path
    else
        echo "Worktree does not exist: $worktree_path"
        return 1
    end
end
```

The difference from `gworktree_open` is that this function does not create anything. It's purely navigation. Useful when you've already created the worktree and just need to get there from a different directory.

```
# jump to an existing worktree from anywhere in the main repo
gworktree cd feature-auth
# → (now in ~/projects/myapp-feature-auth)
```

### Removing a Worktree

`gworktree_rm.fish` removes the worktree with the same path convention:

```fish
function gworktree_rm
    if test (count $argv) -eq 0
        echo "Usage: gworktree rm <branch>"
        return 1
    end

    set branch $argv[1]

    if not git rev-parse --is-inside-work-tree >/dev/null 2>&1
        echo "Not inside a git repository"
        return 1
    end

    set repo_root (git rev-parse --show-toplevel)
    set repo_name (basename $repo_root)
    set parent_dir (dirname $repo_root)
    set worktree_path "$parent_dir/$repo_name-$branch"

    if not test -d $worktree_path
        echo "Worktree does not exist: $worktree_path"
        return 1
    end

    echo "Removing worktree: $worktree_path"
    git worktree remove $worktree_path

    if test $status -ne 0
        echo "Failed to remove worktree. It may have uncommitted changes."
        return 1
    end
end
```

```
# clean worktree — removed immediately
gworktree rm feature-auth
# → Removing worktree: ~/projects/myapp-feature-auth

# worktree has uncommitted changes — fails with an error
gworktree rm feature-auth
# → Failed to remove worktree. It may have uncommitted changes.
```

**Uncommitted changes** — `git worktree remove` will fail rather than silently discard work:

- Worktree is clean → removed immediately
- Worktree has uncommitted changes → fails with an error
- Need to force it anyway → run `git worktree remove --force <path>` directly; the wrapper intentionally doesn't expose that flag

**Branch cleanup** — `gworktree rm` removes the directory but not the branch. To clean up both:

```
gworktree rm feature-auth
git branch -d feature-auth
```

### Help Text

`gworktree_help.fish` prints usage and the directory layout:

```fish
function gworktree_help
    echo ""
    echo "gworktree — manage git worktrees next to the repository"
    echo ""
    echo "COMMANDS"
    echo "  gworktree <branch>"
    echo "      Create a new worktree for the branch or open an existing one."
    echo ""
    echo "  gworktree cd <branch>"
    echo "      Change directory to an existing worktree."
    echo ""
    echo "  gworktree rm <branch>"
    echo "      Remove the worktree for the branch."
    echo ""
    echo "  gworktree ls"
    echo "      List all git worktrees."
    echo ""
    echo "  gworktree -h | gworktree help"
    echo "      Show this help message."
    echo ""
    echo "WORKTREE LAYOUT"
    echo "  Worktrees are created next to the main repository:"
    echo ""
    echo "      project/"
    echo "      project-feature-x/"
    echo "      project-bugfix-y/"
    echo ""
    echo "EXAMPLES"
    echo "  gworktree feature-auth"
    echo "  gworktree cd feature-auth"
    echo "  gworktree rm feature-auth"
    echo "  gworktree ls"
    echo ""
end
```

## Installation

Each file goes in `~/.config/fish/functions/`:

```
~/.config/fish/functions/
    gworktree.fish
    gworktree_open.fish
    gworktree_cd.fish
    gworktree_rm.fish
    gworktree_help.fish
```

Fish auto-loads all `.fish` files in that directory. Open a new terminal or run `funcsave` — the commands are available immediately. No `source` calls, no `config.fish` changes required.

## Real Usage: Two Agents, One Repo

Here is what an actual two-agent session looks like.

**Terminal 1 — Agent 1 on authentication work:**

```
cd ~/projects/myapp
gworktree feature-auth
# → Creating branch and worktree: feature-auth
# → (now in ~/projects/myapp-feature-auth)
claude
```

**Terminal 2 — Agent 2 on a login bug:**

```
cd ~/projects/myapp
gworktree bugfix-login
# → Creating branch and worktree: bugfix-login
# → (now in ~/projects/myapp-bugfix-login)
claude
```

Both agents are now running. They are in different directories, on different branches, with different working trees. They can both modify files, run tests, and make commits without touching each other's state. Agent 1 does not know Agent 2 exists, and that's fine — isolation is the goal.

When Agent 1 finishes and the PR is merged:

```
cd ~/projects/myapp
gworktree rm feature-auth
# → Removing worktree: ~/projects/myapp-feature-auth
git branch -d feature-auth
```

The worktree directory is gone. The branch is cleaned up. The main repo is unchanged.

`gworktree ls` at any point shows the full picture:

```
git worktree list
# ~/projects/myapp               abc1234 [main]
# ~/projects/myapp-feature-auth  def5678 [feature-auth]
# ~/projects/myapp-bugfix-login  ghi9012 [bugfix-login]
```

## What I Learned

The main thing this setup makes clear is that "the same repo" and "the same working directory" are not the same thing. Most developers conflate them because in normal use they are the same. Git worktrees peel those apart and expose the underlying model: one object store, many possible checkouts.

The naming convention matters more than it seems. Because every function derives the worktree path the same way (`$parent_dir/$repo_name-$branch`), there is no registry to maintain and no state to track. The path is the identity. As long as you know the branch name, you can `cd`, remove, or inspect the worktree without any lookup.

The one edge case to watch: if your branch name contains characters that are awkward in a directory path (slashes are the obvious one — e.g., `feature/auth`), the path derivation will produce nested directories rather than a flat sibling. That may or may not be what you want. For branches with slashes I tend to use a flattened name in the worktree: `gworktree feature-auth` instead of trying to pass `feature/auth` directly.

## Beyond AI Agents

The same pattern works for any parallel development scenario. Long-running feature branches where you need to context-switch quickly without stashing. Testing a fix in one worktree while keeping your main work untouched in another. Running two versions of a service locally to compare behavior. The AI agent case makes worktrees feel urgent because agents work fast and the conflicts happen immediately — but the underlying problem (parallel work on the same repo) is not new. Git worktrees have been the right answer for a while. AI agents are just a new reason to actually use them.
