---
title: "Rails Upgrade Phase Five: Rails 6.0 to 6.1"
description: "Navigating the upgrade from Rails 6.0 to 6.1, dealing with Sprockets 4 incompatibilities, cattr_accessor changes, and Sass deprecations."
pubDate: 2026-01-26
tags: ["building-in-public", "engineering", "rails-upgrade", "ruby"]
draft: false
generatedBy: "agent"
image: "/images/blog/rails-upgrade-phase-5-sprockets.png"
---

> **Part of the [Rails 4 to 8 Upgrade Series](/blog/2026-01-26-rails-upgrade-series-from-rails-4-to-8)**

This is part 5 of a multi-phase Rails upgrade journey. After successfully upgrading to Rails 6.0, the next step was Rails 6.1. This felt like it should be straightforward—a minor version bump within Rails 6. But as with every upgrade in this series, there were surprises.

## Context

**Starting point:**

- Rails 6.0.6.1
- Ruby 3.1.6
- 585 passing tests
- 82%+ test coverage

**Target:**

- Rails 6.1.7.10 (latest in the 6.1 series)

Rails 6.1 was released in December 2020 and brought several improvements including horizontal sharding, per-database connection switching, and strict loading associations. More importantly for this upgrade: Zeitwerk became the only autoloader, with the classic autoloader completely removed.

## Original Plan

The plan seemed simple:

1. Update the Gemfile to Rails 6.1
2. Update `config.load_defaults 6.1`
3. Run tests and fix any breakages
4. Clean up deprecated code

I expected this to be one of the smoother upgrades in the series.

## What Changed

### First Attempt: The Sprockets 4 Wall

I updated the Gemfile:

```ruby
gem 'rails', '6.1.7.10'
```

Ran `bundle update rails` and immediately hit a problem when trying to boot the app:

```
undefined method `start_with?' for /bootstrap\/glyphicons-halflings-regular\.(?:eot|svg|ttf|woff)$/:Regexp
```

This error came from deep within the asset pipeline. Rails 6.1 ships with Sprockets 4.2.2 by default, and Sprockets 4 introduced breaking changes around how it handles file paths.

The problem: Our app uses `bootstrap-sass`, which has a clever Regexp-based approach for font paths. Sprockets 4 expects strings with methods like `start_with?`, but bootstrap-sass passes a Regexp. Sprockets 4 doesn't know what to do with it.

I had two options:

1. Replace bootstrap-sass with a more modern solution
2. Pin Sprockets to version 3.x

Given that this was already the fifth phase of a multi-phase upgrade, and the goal was to move methodically through Rails versions, I chose option 2. Replacing the entire CSS framework could be its own project.

**Solution:**

```ruby
gem 'sprockets', '~> 3.7'
```

This pinned Sprockets to 3.7.x, which bootstrap-sass works with. It's technical debt, but it's documented and can be addressed later.

### Configuration Updates

With Sprockets pinned, I moved to configuration changes:

**config/application.rb:**

```ruby
config.load_defaults 6.1
```

I also removed this line:

```ruby
config.autoloader = :zeitwerk  # Removed - Zeitwerk is default and only option
```

In Rails 6.0, you could choose between Zeitwerk and the classic autoloader. Rails 6.1 removed the classic autoloader entirely. The configuration option still works but is meaningless—Zeitwerk is always used.

### The cattr_accessor Surprise

Tests started failing with this error:

```
NoMethodError: undefined method `cattr_accessor' for #<Class:TestWorker>
```

This was coming from test helper code that looked like:

```ruby
class TestWorker < ActiveJob::Base
  class << self
    cattr_accessor :count

    def clear_count
      self.count = 0
    end
  end
end
```

Rails 6.1 changed how `cattr_accessor` works. You can no longer call it inside a `class << self` block. This is a subtle breaking change that's not well documented.

The pattern was using `cattr_accessor` to create a class-level attribute (essentially a class variable with accessors). The `class << self` block was opening up the singleton class to add class methods.

**The fix:**

```ruby
class TestWorker < ActiveJob::Base
  cattr_accessor :count

  def self.clear_count
    self.count = 0
  end
end
```

Move `cattr_accessor` outside the singleton class block and define class methods normally with `def self.method_name`. This works because `cattr_accessor` already creates class-level accessors—you don't need to be inside `class << self` for it.

### Sass Deprecation Warnings

After getting tests passing, I noticed new deprecation warnings flooding the console:

```
DEPRECATION WARNING: Using / for division outside of calc() is deprecated
DEPRECATION WARNING: lighten() is deprecated. Suggestions: color.scale(), color.adjust()
DEPRECATION WARNING: unquote() is deprecated
```

These warnings are coming from Dart Sass, which is deprecating older Sass syntax that bootstrap-sass relies on. While these are warnings (not errors), they make test output noisy and hard to read.

I added these to the Sass silence_deprecations config:

```ruby
silence_deprecations: %w[
  global-builtin
  color-functions
  import
]
```

This is another piece of technical debt tied to bootstrap-sass. When we eventually migrate away from bootstrap-sass to a modern CSS solution, these warnings will disappear.

### Deprecation Warnings for Rails 7.0

Rails 6.1 helpfully surfaces deprecation warnings for APIs that will be removed in Rails 7.0:

**`connection_config` → `connection_db_config`:**

```
DEPRECATION WARNING: connection_config is deprecated and will be removed from Rails 7.0
```

This showed up in database configuration code. The fix is straightforward—use `connection_db_config` instead—but I'm leaving this for the Rails 7 upgrade phase.

**`fixture_file_upload` path changes:**

```
DEPRECATION WARNING: Passing a path to fixture_file_upload relative to fixture_path is deprecated
```

Rails 7.0 will require absolute paths or paths relative to the test file. Again, leaving this for the next phase.

## What I Learned

### 1. **Sprockets 4 is a Breaking Change**

Rails 6.1's inclusion of Sprockets 4 is a bigger deal than the release notes suggest. If you're using older CSS/asset gems (like bootstrap-sass, compass-rails, etc.), expect breakage.

The error messages are cryptic—`undefined method 'start_with?' for Regexp` doesn't immediately tell you "your CSS framework is incompatible with the new asset pipeline."

Pinning Sprockets to 3.x is a valid stopgap, but it's technical debt. Document it and plan to address it.

### 2. **Classic Autoloader Removal is Final**

Rails 6.0 gave you a choice between Zeitwerk and classic. Rails 6.1 removes the choice entirely.

If you successfully ran on Zeitwerk in Rails 6.0, this is a non-issue. If you were still using classic, you must fix Zeitwerk compatibility before upgrading to 6.1.

### 3. **cattr_accessor Behavior Changed**

The change to `cattr_accessor` inside singleton classes is subtle and easy to miss. It's not prominently documented in upgrade guides.

If you have test helpers or metaprogramming code that uses `cattr_accessor`, expect to refactor. The fix is simple once you know what's wrong, but the error message (`undefined method`) isn't obvious.

### 4. **Deprecation Warnings are a Roadmap**

Rails 6.1 surfaces deprecation warnings for Rails 7.0. Rather than fix them all immediately, I'm noting them and deferring to the next upgrade phase.

This approach keeps each upgrade focused and prevents scope creep. It also means each phase's git history clearly shows what changed and why.

### 5. **Technical Debt Compounds**

This upgrade added two pieces of technical debt:

- Pinning Sprockets to 3.x
- Silencing Sass deprecation warnings

Both are tied to bootstrap-sass. Both will need to be addressed eventually.

The lesson: sometimes you accept technical debt to keep moving forward. The key is to document it clearly so future-you (or future-teammates) understand the tradeoff.

## Next Steps

**Immediate:**

- Rails 6.1.7.10 is running
- All 585 tests passing
- 82.28% code coverage maintained

**For Rails 7.0:**

- Replace `connection_config` with `connection_db_config`
- Fix `fixture_file_upload` paths
- Address Sprockets 3.x pinning (possibly migrate away from bootstrap-sass)
- Remove Sass deprecation silencing

**Eventual:**

- Migrate from bootstrap-sass to a modern CSS framework
- This will resolve both the Sprockets 4 and Sass deprecation issues

## Conclusion

Rails 6.0 → 6.1 felt like it should be easy. And compared to earlier phases (Rails 4.2 → 5.0 was brutal), it was. But "easy" doesn't mean "no surprises."

Sprockets 4, cattr_accessor changes, and Sass deprecations all required investigation and thoughtful decisions. The upgrade took a few hours, not days, but it wasn't a simple `bundle update`.

The incremental approach continues to pay off. By maintaining test coverage and moving methodically through versions, I can isolate issues and make informed tradeoff decisions.

On to Rails 7.0.

---

**Upgrade Stats:**

- **Time**: ~3 hours
- **Tests**: 585 passing (100% maintained)
- **Coverage**: 82.28%
- **Commits**: 2 (upgrade, deprecation fixes)
- **Technical Debt Added**: 2 items (documented)

---

## Series Navigation

- **Previous**: [Phase 4: Rails 6.0 (Zeitwerk, Apple Silicon, Ruby 3)](/blog/2026-01-26-rails-6-upgrade-surviving-zeitwerk-apple-silicon-and-ruby-3)
- **Next**: [Phase 6: Rails 6.1 to 7.0](/blog/2026-01-26-rails-upgrade-phase-6-rails-6-1-to-7-0)
- **Series Index**: [Rails 4 to 8 Upgrade Series](/blog/2026-01-26-rails-upgrade-series-from-rails-4-to-8)
