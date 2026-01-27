---
title: "Rails Upgrade Phase Six: Rails 6.1 to 7.0"
description: "Navigating Zeitwerk timing issues, Airbrake gem incompatibilities, and fixture path changes in the Rails 7.0 upgrade."
pubDate: 2026-01-26
tags: ["building-in-public", "engineering", "rails-upgrade", "ruby"]
draft: false
generatedBy: "agent"
image: "/images/blog/rails-upgrade-phase-6-rails7.png"
---

> **Part of the [Rails 4 to 8 Upgrade Series](/blog/2026-01-26-rails-upgrade-series-from-rails-4-to-8)**

This is part 6 of a multi-phase Rails upgrade journey. After successfully reaching Rails 6.1, the next major milestone is Rails 7.0. This is a significant jump—Rails 7 introduced new defaults, removed deprecated APIs, and changed how several core components behave.

## Context

**Starting point:**

- Rails 6.1.7.10
- Ruby 3.1.6
- 585 passing tests
- 82% test coverage

**Target:**

- Rails 7.0.8.7 (latest in the 7.0 series)

Rails 7.0 was released in December 2021 and brought substantial changes: a new default asset pipeline (import maps), Hotwire as the default SPA alternative, and the removal of several long-deprecated APIs. For a legacy app like ours, the challenge wasn't adopting the new features—it was dealing with the removals and behavioral changes.

## Original Plan

The upgrade strategy followed the established pattern:

1. Update Gemfile to Rails 7.0
2. Update `config.load_defaults 7.0`
3. Run tests and fix failures
4. Address deprecation warnings surfaced in Rails 6.1
5. Manual testing of critical paths

Based on previous phases, I expected issues around:

- Deprecated ActiveRecord methods
- Changed test helpers
- Gem compatibility (several gems would need updates)

What I didn't expect: Zeitwerk timing issues that broke initialization.

## What Changed

### Issue 1: Zeitwerk Autoloading Timing with Initializers

**Symptom:**

After upgrading to Rails 7.0, the app failed to boot with:

```
uninitialized constant Payments (NameError)
config/initializers/payments.rb:1:in `<top (required)>'
```

The initializer looked like this:

```ruby
# config/initializers/payments.rb
Payments.initialize_payment_gateway
```

This worked fine in Rails 6.1. In Rails 7.0, it exploded.

**Root cause:**

Rails 7.0 changed when initializers run relative to Zeitwerk autoloading. In previous versions, Zeitwerk would load constants on-demand before initializers ran. In Rails 7.0, the timing shifted.

The `lib/payments.rb` module exists and is configured to be autoloaded:

```ruby
# config/application.rb
config.autoload_paths << Rails.root.join('lib')
```

But when `config/initializers/payments.rb` runs during boot, Zeitwerk hasn't loaded `Payments` yet. The reference to `Payments.initialize_payment_gateway` triggers a constant lookup, which fails.

**The fix:**

Wrap the initializer code in `Rails.application.config.after_initialize`:

```ruby
# config/initializers/payments.rb
Rails.application.config.after_initialize do
  Payments.initialize_payment_gateway
end
```

This defers execution until after Zeitwerk has fully loaded all constants. The `after_initialize` callback runs after all initializers and after eager loading (in production) or lazy loading setup (in development).

**Why this matters:**

If you have initializers that reference autoloaded constants from `lib/` or `app/` directories, they might break in Rails 7.0. The solution is to wrap them in `after_initialize` blocks or explicitly `require` the files at the top of the initializer.

### Issue 2: Airbrake Gem Incompatibility

**Symptom:**

After getting past the Zeitwerk issue, the app booted but immediately crashed with:

```
NoMethodError: undefined method 'connection_config' for ActiveRecord::Base:Class
```

This error came from the Airbrake gem. Looking at the stack trace, Airbrake's Rails integration was calling `ActiveRecord::Base.connection_config`.

**Root cause:**

The `connection_config` method was deprecated in Rails 6.1 and removed entirely in Rails 7.0. Our Gemfile had:

```ruby
gem 'airbrake', '~> 9.0'
```

Airbrake 9.x was released in 2018 and still used `connection_config`. It wasn't compatible with Rails 7.0.

**The fix:**

Upgrade Airbrake to 13.x:

```ruby
gem 'airbrake', '~> 13.0'
```

Airbrake 13.x (released in 2021) uses the new `connection_db_config` API and is Rails 7.0 compatible.

**Why this matters:**

Rails 7.0 removed several long-deprecated methods. If you have gems that haven't been updated in years, they likely rely on APIs that no longer exist. Check your gems' compatibility before upgrading, and expect to bump major versions.

### Issue 3: fixture_file_upload Path Changes

**Symptom:**

Tests started failing with:

```
ArgumentError: the directory '/path/to/test/fixtures/files/files' does not contain a file named 'batch_upload_simple.csv'
```

The test code looked like:

```ruby
file = fixture_file_upload('files/batch_upload_simple.csv', 'text/csv')
```

The file structure was:

```
test/
  fixtures/
    files/
      batch_upload_simple.csv
```

In Rails 6.1, this worked. In Rails 7.0, it's looking for `test/fixtures/files/files/batch_upload_simple.csv`.

**Root cause:**

Rails 7.0 changed how `fixture_file_upload` resolves paths. Previously, you'd specify the path relative to `test/fixtures/`, including the `files/` directory.

In Rails 7.0, `fixture_file_upload` automatically looks in `test/fixtures/files/` without needing the `files/` prefix in your path.

**The fix:**

Remove the `files/` prefix from all `fixture_file_upload` calls:

```ruby
# Before
file = fixture_file_upload('files/batch_upload_simple.csv', 'text/csv')

# After
file = fixture_file_upload('batch_upload_simple.csv', 'text/csv')
```

This required updating multiple test files that used file uploads.

**Why this matters:**

This is a silent breaking change. If you miss a file upload test, it will fail. The fix is straightforward once you understand the pattern, but the error message (`directory does not contain a file`) is misleading—it suggests the file is missing, not that the path convention changed.

### Issue 4: Constant Reinitialization Warning

**Symptom:**

After all tests passed, running the test suite showed a new warning:

```
warning: already initialized constant Payments::Transaction::PayPal::ERROR_CODE_KLASS
```

This warning appeared multiple times during test runs, especially when running the full suite.

**Root cause:**

The constant was defined like this:

```ruby
# lib/payments/transaction/paypal.rb
module Payments
  module Transaction
    module PayPal
      ERROR_CODE_KLASS = {
        10486 => "InvalidTransactionError",
        # ... more error codes
      }.freeze
    end
  end
end
```

Rails 7.0's Zeitwerk eager loading in tests was causing the file to be loaded multiple times, redefining the constant. This wasn't an error, but it was noisy and suggested a code smell.

**The fix:**

Add a guard to prevent redefinition:

```ruby
# lib/payments/transaction/paypal.rb
module Payments
  module Transaction
    module PayPal
      unless defined?(ERROR_CODE_KLASS)
        ERROR_CODE_KLASS = {
          10486 => "InvalidTransactionError",
          # ... more error codes
        }.freeze
      end
    end
  end
end
```

The `unless defined?` check prevents the constant from being redefined if it already exists.

**Why this matters:**

Zeitwerk is strict about constant definitions. If you have constants defined at the module level (especially in `lib/`), you might see reinitialization warnings in Rails 7.0. The fix is to guard them with `unless defined?` or restructure the code to avoid reloading.

### Configuration Updates

Updated `config/application.rb`:

```ruby
config.load_defaults 7.0
```

This enables Rails 7.0's default behaviors for:

- ActionMailer: `button_to` generates `<button>` tags instead of `<input>` tags
- ActiveRecord: schema dumps default to SQL instead of Ruby
- ActiveJob: encryption enabled by default
- ActiveSupport: cache format version updated

Most of these are backward-compatible, but it's worth reviewing the defaults guide to understand what changed.

## What I Learned

### 1. Zeitwerk Timing is Critical

Rails 7.0 tightened when initializers run relative to autoloading. If your initializers reference autoloaded constants, they might break.

The solution:

- Use `Rails.application.config.after_initialize` for code that needs autoloaded constants
- Or explicitly `require` the files at the top of the initializer
- Avoid referencing `lib/` constants directly in initializers unless you're sure they're loaded

This is a case where "it worked in Rails 6.1" doesn't mean it was correct—it was just lucky timing.

### 2. Gem Compatibility is Non-Negotiable

Airbrake wasn't the only gem that needed updates. Several other gems required major version bumps to support Rails 7.0.

Before upgrading Rails:

- Check gem changelogs for Rails 7.0 support
- Look for deprecation warnings in Rails 6.1 (they tell you what will break)
- Expect to update gems to major new versions

Gem updates often introduce their own breaking changes, so plan time for that too.

### 3. fixture_file_upload Changes are Subtle

The path change in `fixture_file_upload` is the kind of breaking change that's easy to miss. It's not in the upgrade guide's "big changes" section. It's buried in the ActionDispatch changelog.

Lesson: Run your full test suite after upgrading. Don't just check for boot errors—run every test to catch subtle behavior changes.

### 4. Constant Redefinition Warnings Matter

The `already initialized constant` warning wasn't breaking tests, but it was noisy. These warnings often indicate code that will break in future Ruby or Rails versions.

When you see constant warnings:

- Don't ignore them
- Don't silence them blindly
- Fix the underlying issue (usually with `unless defined?` guards or refactoring)

### 5. Incremental Upgrades Still Pay Off

This was the sixth phase of our Rails upgrade journey. Each phase built on the previous:

- Phase 1: Test coverage (30% → 80%)
- Phase 2-3: Rails 4.2 → 5.2
- Phase 4: Rails 5.2 → 6.0 (Zeitwerk)
- Phase 5: Rails 6.0 → 6.1 (Sprockets, cattr_accessor)
- Phase 6: Rails 6.1 → 7.0 (this post)

Because we moved incrementally and maintained test coverage throughout, each upgrade was manageable. If we had tried to jump from Rails 4.2 to 7.0 in one go, these issues would have been impossible to debug.

## Results

After all fixes:

- All 585 tests passing
- 0 failures, 0 errors
- 82% code coverage maintained
- Clean test output (no warnings)

Rails 7.0 is now running in development and ready for production deployment.

## Next Steps

**Immediate:**

- Rails 7.0.8.7 is stable
- Deploy to staging for full integration testing
- Monitor production logs for issues missed by tests

**For Rails 7.1:**

- Consider removing Sprockets 3.x pin and addressing bootstrap-sass (technical debt from Phase 5)
- Review new Rails 7.1 features (async queries, composite primary keys)
- Check gem compatibility for Rails 7.1

**For Rails 8.0 (final goal):**

- Evaluate Propshaft vs Sprockets (Rails 8 defaults to Propshaft)
- Plan for Turbo/Stimulus adoption (if beneficial)
- Consider migrating to modern CSS tooling

## Conclusion

Rails 6.1 → 7.0 was one of the more challenging upgrades in this series. Not because of massive breaking changes, but because of subtle timing and behavior changes that were hard to diagnose.

The Zeitwerk timing issue with initializers took the most time to debug. The error message (`uninitialized constant`) pointed to the symptom, not the cause. Understanding that initializers now run before autoloading completes was the key insight.

The incremental upgrade strategy continues to prove its value. By moving methodically through versions, maintaining tests, and documenting technical debt, each phase is manageable. Six phases in, we're now on Rails 7.0 with two more versions to go.

On to Rails 7.1.

---

**Upgrade Stats:**

- **Time**: ~4 hours
- **Tests**: 585 passing (100% maintained)
- **Coverage**: 82.28%
- **Major Issues**: 4 (Zeitwerk timing, Airbrake, fixture paths, constant warnings)
- **Commits**: 3 (upgrade, fixes, deprecation cleanup)

---

## Series Navigation

- **Previous**: [Phase 5: Rails 6.0 to 6.1](/blog/2026-01-26-rails-upgrade-phase-5-rails-6-0-to-6-1)
- **Next**: [Phase 7: Rails 7.0 to 7.1](/blog/2026-01-26-rails-upgrade-phase-7-rails-7-0-to-7-1)
- **Series Index**: [Rails 4 to 8 Upgrade Series](/blog/2026-01-26-rails-upgrade-series-from-rails-4-to-8)
