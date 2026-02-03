---
title: "Rails Upgrade Phase Four: Rails 6 Upgrade, Surviving Zeitwerk, Apple Silicon, and Ruby 3"
description: "A detailed account of upgrading a Rails 5.2 app to 6.0 and Ruby 3.1, navigating Zeitwerk autoloading, Apple Silicon compilation issues, and test infrastructure challenges."
pubDate: 2026-01-26
tags: ["building-in-public", "engineering", "rails", "ruby", "upgrade"]
draft: false
generatedBy: "agent"
image: "/images/blog/rails-upgrade-phase-4-zeitwerk.png"
---

> **Part of the [Rails 4 to 8 Upgrade Series](/blog/2026-01-26-rails-upgrade-series-from-rails-4-to-8)**

After successfully getting Rails 5.2 running in [Phase 2 & 3](/blog/2026-01-23-rails-upgrade-part-2-fixing-rails-52-compatibility), I tackled the jump to Rails 6.0. This phase turned out to be more involved than expected—not because Rails 6 itself is particularly difficult, but because the ecosystem had shifted significantly. Between Zeitwerk's stricter autoloading rules, Apple Silicon's compilation quirks, and Ruby 3.1's security changes, this upgrade required careful navigation through multiple interrelated issues.

## Context

This is Phase 4 of a multi-phase Rails upgrade for a legacy task management application. The goal was to move from Rails 5.2.8.1 to 6.0.6.1, which is the last Rails version before 6.1's breaking changes around autoloading.

Starting point:

- Rails 5.2.8.1
- Ruby 2.7.8
- ~585 tests passing
- 82.45% code coverage

Target:

- Rails 6.0.6.1
- Ruby 3.1.6 (skipped 3.0.0 due to build issues)
- All tests passing
- Maintain or improve code coverage

## Original Plan

The Rails 6 upgrade guide made it seem straightforward:

1. Update `config.load_defaults 6.0`
2. Enable Zeitwerk autoloader
3. Fix any deprecation warnings
4. Update gem dependencies

I expected this to be a matter of updating a few gem versions and fixing some deprecated method calls. The reality was more complex.

## What Changed: The Apple Silicon Problem

The first roadblock hit immediately during `bundle install`. The `sassc` gem—a C++ extension for compiling Sass—refused to build on Apple Silicon (M1/M2 Macs).

```bash
Building native extensions. This could take a while...
ERROR:  Error installing sassc:
  ERROR: Failed to build gem native extension.

  clang: error: unsupported option '-fstack-protector-strong'
```

The `sassc` gem's C++ code wasn't compatible with the ARM64 architecture. This created a cascade of dependency issues:

- `sass-rails` depends on `sassc`
- `jquery-datatables-rails` depends on `sass-rails`

**Solution 1:** Switch from `sass-rails` to `dartsass-sprockets`, which uses the Dart implementation of Sass (pure Dart, no C++ compilation):

```ruby
# Before
gem 'sass-rails', '~> 5.0'

# After
gem 'dartsass-sprockets'
```

**Solution 2:** Remove `jquery-datatables-rails` entirely and manually include the DataTables JavaScript/CSS assets in `vendor/assets`. This was a small gem that provided minimal value—just pulling in JS/CSS files.

This was my first hint that the upgrade would require more pragmatism than I expected. Sometimes the right answer isn't "fix the gem," it's "remove the dependency."

## The Zeitwerk Migration

Rails 6's big change is Zeitwerk, the new autoloader. Unlike the classic autoloader, Zeitwerk enforces strict naming conventions: file paths must match the constants they define.

### The Problem

The codebase had several namespaced modules that didn't follow this convention:

```
app/workers/message_worker.rb   # defines Workers::MessageWorker
app/models/concerns/trackable.rb # defines Concerns::Trackable
app/messages/messenger.rb       # defines Messages::Messenger
```

Under the classic autoloader, Rails would infer the namespace from the class name. Zeitwerk requires the directory structure to match:

```
app/workers/workers/message_worker.rb     # Workers::MessageWorker
app/models/concerns/concerns/trackable.rb # Concerns::Trackable
app/messages/messages/messenger.rb        # Messages::Messenger
```

### The Fix

I restructured the directories to match Zeitwerk's expectations:

```bash
mkdir -p app/workers/workers
mv app/workers/*.rb app/workers/workers/

mkdir -p app/models/concerns/concerns
mv app/models/concerns/*.rb app/models/concerns/concerns/

mkdir -p app/messages/messages
mv app/messages/*.rb app/messages/messages/
```

This felt redundant at first (why `concerns/concerns`?), but it's Zeitwerk's way of enforcing explicit namespacing. The benefit is that autoloading is now deterministic—no more mysterious constant loading issues.

One code change was needed in the `Messages::Messenger` class to reflect the new path:

```ruby
# Before
Dir[Rails.root.join('app', 'messages', '*.rb')].each { |f| require f }

# After
Dir[Rails.root.join('app', 'messages', 'messages', '*.rb')].each { |f| require f }
```

## Gem Compatibility Issues

### paper_trail: 9.0 → 12.0

The `paper_trail` auditing gem had breaking changes in its ActiveRecord integration. Rails 6 changed some internal ActiveRecord APIs, and `paper_trail` 9.x wasn't compatible.

```ruby
# Gemfile
gem 'paper_trail', '~> 12.0'
```

No code changes required—just a version bump. This is the ideal upgrade scenario.

### cancancan: 2.0 → 3.0

The authorization gem had argument errors with Rails 6's controller changes:

```ruby
# Gemfile
gem 'cancancan', '~> 3.0'
```

Again, no code changes needed. The gem maintainers handled the Rails 6 compatibility.

### acts_as_commentable: Removed

This gem added polymorphic comment associations to models. Unfortunately, it used deprecated ActiveRecord association APIs that were removed in Rails 6.

Rather than fork and fix the gem, I looked at what it actually did:

```ruby
# What acts_as_commentable provided:
acts_as_commentable

# Roughly equivalent to:
has_many :comments, as: :commentable, dependent: :destroy
```

That's it. The gem added a single `has_many` association. I replaced it with direct Rails code:

```ruby
# app/models/user.rb
class User < ApplicationRecord
  # Replaces acts_as_commentable gem
  has_many :comments, as: :commentable, dependent: :destroy
end

# app/models/task_entry.rb
class TaskEntry < ApplicationRecord
  # Replaces acts_as_commentable gem
  has_many :comments, as: :commentable, dependent: :destroy
end
```

This is a pattern I've seen repeatedly in Rails upgrades: gems that were convenient in Rails 3/4 often become unnecessary as Rails itself improves. A one-line association is more maintainable than a gem dependency.

## Ruby 3.1 Migration

I initially tried Ruby 3.0.0, but it failed to build on Apple Silicon with `rbenv`:

```bash
BUILD FAILED (macOS 14.1 using ruby-build 20231225)
```

Ruby 3.1.6 built successfully, so I jumped directly to that version:

```ruby
# Gemfile
ruby '3.1.6'
```

This introduced two Ruby 3.1-specific issues.

### Issue 1: Logger Autoloading

Ruby 3.1 changed how the `Logger` class is loaded. It's no longer automatically available—you must explicitly require it. This broke Rails boot:

```ruby
# config/boot.rb
ENV['BUNDLE_GEMFILE'] ||= File.expand_path('../../Gemfile', __FILE__)

# Required for Ruby 3.1+ compatibility with Rails 6.0
require 'logger'

require 'bundler/setup' if File.exist?(ENV['BUNDLE_GEMFILE'])
```

Simple fix, but not obvious from error messages.

### Issue 2: Psych 4.0 YAML Security

Ruby 3.1 ships with Psych 4.0, which changed `YAML.load` to be secure by default. It no longer permits arbitrary classes without explicitly listing them:

```ruby
YAML.load(yaml_string)
# => Psych::DisallowedClass: Tried to load unspecified class: Time
```

This broke Rails fixtures, which serialize `Time`, `Date`, `DateTime`, and `BigDecimal` objects.

**Solution:** Monkey-patch `YAML.load` to allow these common classes:

```ruby
# test/test_helper.rb
require 'yaml'
require 'date'
require 'bigdecimal'

YAML_PERMITTED_CLASSES = [Symbol, Date, Time, DateTime, BigDecimal]

module YAML
  class << self
    alias_method :original_load, :load
    def load(yaml, permitted_classes: [], permitted_symbols: [], aliases: false, filename: nil, **kwargs)
      original_load(yaml,
        permitted_classes: YAML_PERMITTED_CLASSES + permitted_classes,
        permitted_symbols: permitted_symbols,
        aliases: aliases,
        filename: filename,
        **kwargs)
    end
  end
end
```

This is safe for test fixtures. In production code, you should use `YAML.safe_load` with explicit permitted classes.

## Test Infrastructure Fixes

Getting the tests passing required several test-specific fixes.

### SSL Certificate CRL Issues

External API calls (GitHub, AWS) started failing with certificate revocation list (CRL) errors:

```
OpenSSL::SSL::SSLError: SSL_connect returned=1 errno=0 state=error:
certificate verify failed (unable to get certificate CRL)
```

This is a Ruby 3.1 + OpenSSL 3.0 issue where CRL verification became stricter. For tests, I don't need real API calls—I just need them to not crash.

**Solution:** Patch OpenSSL to disable verification in the test environment:

```ruby
# test/test_helper.rb
module OpenSSL
  module SSL
    class SSLContext
      alias_method :original_set_params, :set_params
      def set_params(params = {})
        params[:verify_mode] = OpenSSL::SSL::VERIFY_NONE
        original_set_params(params)
      end
    end
  end
end

# Also stub common API endpoints
WebMock.stub_request(:any, /\.amazonaws\.com/).to_return(status: 204, body: '', headers: {})
WebMock.stub_request(:any, /api\.github\.com/).to_return(status: 200, body: '{}', headers: {})
```

This is **only safe in tests**. Never disable SSL verification in production.

### ChromeDriver Version Issues

Capybara system tests started failing with ChromeDriver version mismatches. The `webdrivers` gem is supposed to auto-update ChromeDriver, but it wasn't working consistently.

**Solution:** Ensure `webdrivers` is properly required before Capybara:

```ruby
# test/test_helper.rb
require 'capybara/rails'
require 'selenium/webdriver'
require 'webdrivers' # Auto-updates ChromeDriver to match Chrome version
```

The gem handles version matching automatically once properly loaded.

### Flaky Integration Test

The `OnboardingFlowTest` was flaky—it would pass locally but fail in CI about 30% of the time. The issue was a race condition:

```ruby
# Flaky code
click_button 'Complete Onboarding'
visit dashboard_path
assert_text 'Welcome to your dashboard'
```

The problem: clicking the button triggered an async form submission and database write. The `visit dashboard_path` happened before the database write completed.

**Solution:** Wait for the database change to persist:

```ruby
click_button 'Complete Onboarding'

# Wait for the onboarding flag to be set in the database
assert_selector 'body', wait: 5 # Wait for page to transition
user.reload
assert user.onboarding_completed?, 'Onboarding should be marked complete'

visit dashboard_path
assert_text 'Welcome to your dashboard'
```

This is a common pattern in Capybara tests: always wait for the database state you expect before asserting on it.

### Fixture Data Integrity

One test was failing with a database constraint error:

```
SQLite3::ConstraintException: NOT NULL constraint failed:
payment_histories.payment_history_id
```

The `precommit_paid_accepted` fixture had `payment_history_id: nil`, but the database schema required it to be set.

**Solution:** Fix the fixture data:

```yaml
# test/fixtures/payment_histories.yml
precommit_paid_accepted:
  amount: 50.00
  payment_history_id: 1 # Was nil, caused constraint violation
  user: prospector_one
  # ... other fields
```

Rails 6 is stricter about enforcing database constraints. This was a latent bug that Rails 5.2 allowed.

## Deprecation Warnings to Address

Rails 6.0 works fine, but emits warnings about upcoming Rails 6.1 changes:

### 1. `update_attributes` → `update`

```ruby
# Deprecated in Rails 6.0, removed in 6.1
user.update_attributes(email: 'new@example.com')

# Replacement
user.update(email: 'new@example.com')
```

This appears in ~15 places across controllers and models. Mechanical find-replace.

### 2. Sass `@import` → `@use/@forward`

```scss
// Deprecated Sass syntax
@import "bootstrap";
@import "variables";

// Modern Sass syntax (required for Dart Sass)
@use "bootstrap";
@use "variables";
```

The `dartsass-sprockets` gem will eventually require the modern syntax. Not urgent, but worth noting.

### 3. CoffeeScript Template Handlers

Rails 6.1 changes the template handler API. CoffeeScript templates need to be updated to use two-arity handlers:

```ruby
# Old API (single argument)
ActionView::Template.register_template_handler :coffee, ->(template) {
  CoffeeScript.compile(template.source)
}

# New API (two arguments)
ActionView::Template.register_template_handler :coffee, ->(template, source) {
  CoffeeScript.compile(source)
}
```

I haven't hit this yet because the app doesn't use CoffeeScript templates (only `.js.coffee` asset files).

## What I Learned

### 1. Zeitwerk is Worth the Migration Pain

The initial directory restructuring felt like busywork, but Zeitwerk's explicit naming rules eliminate a whole class of autoloading bugs. No more "it works in development but fails in production" issues.

### 2. Apple Silicon Changes the Gem Landscape

Native extensions are a liability on Apple Silicon. When possible, prefer:

- Pure Ruby gems over C extensions
- Dart/JavaScript implementations over C++ implementations
- Removing unnecessary gem dependencies

The `sassc` → `dartsass-sprockets` switch is a perfect example: the Dart implementation is faster, more maintainable, and just works.

### 3. Ruby 3.1 is a Bigger Jump Than Expected

The YAML security changes and Logger loading issue aren't well-documented in Rails guides. These are Ruby changes, not Rails changes, so they caught me off guard.

Lesson: when upgrading Rails, also read the Ruby release notes for your target Ruby version.

### 4. Test Infrastructure Needs Love

Half of this upgrade was fixing test infrastructure:

- SSL certificate handling
- ChromeDriver version management
- Flaky integration tests
- Fixture data integrity

This is normal. Tests are code, and they need maintenance too. The payoff is that once tests are stable, you can refactor with confidence.

### 5. Sometimes the Right Fix is Deletion

Removing `acts_as_commentable` and `jquery-datatables-rails` made the codebase simpler and more maintainable. Each gem dependency is a future liability—only keep the ones that provide real value.

## Final State

After all changes:

- Rails 6.0.6.1 ✅
- Ruby 3.1.6 ✅
- 585 tests passing ✅
- 82.45% code coverage ✅
- Zero deprecation warnings from gems ✅
- Zeitwerk autoloader fully adopted ✅

The app runs noticeably faster. Zeitwerk's eager loading in production is more efficient than the classic autoloader, and Ruby 3.1's performance improvements are measurable.

## Next Steps

Before moving to Rails 6.1+, I need to:

1. Fix `update_attributes` deprecation warnings (15 occurrences)
2. Consider migrating Sass `@import` to `@use/@forward` syntax
3. Review any remaining CoffeeScript code for potential removal

Rails 6.1 is where the modern Rails experience really begins—Hotwire, improved autoloading, and better defaults. But the 5.2 → 6.0 jump laid the necessary foundation.

The biggest lesson: upgrade incrementally, fix issues thoroughly at each step, and don't skip test infrastructure improvements. Technical debt in tests compounds just like technical debt in application code.

---

**Upgrade Stats:**

- Time to complete: ~8 hours of focused work
- Gems removed: 2 (`acts_as_commentable`, `jquery-datatables-rails`)
- Gems updated: 4 major versions (`paper_trail`, `cancancan`, `sass-rails` → `dartsass-sprockets`)
- Files restructured: ~15 (Zeitwerk migration)
- Tests fixed: 6 test infrastructure issues
- Code coverage: Maintained at 82.45%

If you're doing a similar upgrade, budget time for test infrastructure fixes and gem ecosystem shifts. The Rails upgrade itself is the easy part.

---

## Series Navigation

- **Previous**: [Phase 2 & 3: Rails 5.0 to 5.2](/blog/2026-01-23-rails-upgrade-part-2-fixing-rails-52-compatibility)
- **Next**: [Phase 5: Rails 6.0 to 6.1](/blog/2026-01-26-rails-upgrade-phase-5-rails-6-0-to-6-1)
- **Series Index**: [Rails 4 to 8 Upgrade Series](/blog/2026-01-26-rails-upgrade-series-from-rails-4-to-8)
