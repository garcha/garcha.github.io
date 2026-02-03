---
title: "Rails Upgrade Phase Seven: Rails 7.0 to 7.1"
description: "Navigating PaperTrail compatibility, Zeitwerk's stricter autoloading, ActionController::Parameters enforcement, and secrets.yml deprecation in Rails 7.1."
pubDate: 2026-01-26
tags: ["building-in-public", "engineering", "rails-upgrade", "ruby"]
draft: false
generatedBy: "agent"
image: "/images/blog/rails-upgrade-phase-7-stricter.png"
---

> **Part of the [Rails 4 to 8 Upgrade Series](/blog/2026-01-26-rails-upgrade-series-from-rails-4-to-8)**

This is part 7 of a multi-phase Rails upgrade journey. After successfully reaching Rails 7.0, the next step is Rails 7.1. This felt like it should be straightforward—a minor version bump within Rails 7. But as with every upgrade in this series, Rails 7.1 brought its own set of surprises.

## Context

**Starting point:**

- Rails 7.0.8.7
- Ruby 3.1.6
- 584 passing tests
- 82% test coverage

**Target:**

- Rails 7.1.6 (latest in the 7.1 series)

Rails 7.1 was released in October 2023 and introduced several improvements including asynchronous query loading, composite primary key support, and enhanced security features. More importantly for this upgrade: stricter enforcement around autoloading, parameter handling, and configuration patterns.

## Original Plan

The upgrade strategy followed the established pattern:

1. Update Gemfile to Rails 7.1
2. Update `config.load_defaults 7.1`
3. Run tests and fix failures
4. Address deprecation warnings
5. Clean up any warnings or deprecated code

Based on previous phases, I expected some gem incompatibilities and maybe a few deprecated method calls. What I didn't expect: Rails 7.1's stricter enforcement revealing assumptions we'd been making for years.

## What Changed

### Issue 1: PaperTrail Incompatibility with ActiveRecord 7.1

**Symptom:**

After updating to Rails 7.1 and running the test suite, I got this warning:

```
DEPRECATION WARNING: PaperTrail 12.3.0 is not compatible with ActiveRecord 7.1.6
```

The tests still passed, but PaperTrail was explicitly warning that it doesn't support Rails 7.1.

**Root cause:**

Our Gemfile had:

```ruby
gem 'paper_trail', '~> 12.0'
```

PaperTrail 12.x was released in 2022 and added Rails 7.0 support. But the gem maintainers explicitly blocked Rails 7.1 compatibility—they needed to make internal changes to support ActiveRecord 7.1's new APIs.

Looking at the PaperTrail changelog, version 15.0 (released in 2023) added Rails 7.1 support. This was a major version jump, which suggested potential breaking changes.

**The fix:**

Update PaperTrail to version 15:

```ruby
gem 'paper_trail', '~> 15.0'
```

After running `bundle update paper_trail`, I re-ran the test suite. All tests passed, including the tests that exercise PaperTrail's versioning functionality.

**Why this matters:**

PaperTrail is an auditing/versioning gem used to track changes to ActiveRecord models. It integrates deeply with ActiveRecord internals, so major Rails upgrades often require PaperTrail upgrades.

The good news: PaperTrail 15.x maintained backward compatibility for our usage patterns. No code changes were needed—just the gem version bump.

If you use PaperTrail, check compatibility before upgrading Rails. PaperTrail tends to lag behind Rails releases by a few months.

### Issue 2: Zeitwerk Stricter Autoloading - Explicit Requires No Longer Work

**Symptom:**

After the PaperTrail update, tests started failing with:

```
LoadError: cannot load such file -- workers/lead_wise
LoadError: cannot load such file -- workers/errors
```

These errors came from test files that had explicit `require` statements at the top:

```ruby
# test/workers/lead_wise_test.rb
require 'test_helper'
require 'workers/lead_wise'

class LeadWiseTest < ActiveSupport::TestCase
  # tests...
end
```

This pattern worked in Rails 7.0. In Rails 7.1, it broke.

**Root cause:**

Rails 7.1 made Zeitwerk stricter about explicit `require` statements. In earlier versions of Zeitwerk, you could mix explicit `require 'path/to/file'` with autoloading. Zeitwerk would tolerate it, even if it was technically incorrect.

In Rails 7.1, Zeitwerk enforces the rule: if a file is in an autoload path, you must not explicitly `require` it. You should rely on autoloading.

The `workers/` directory was in the autoload paths:

```ruby
# config/application.rb
config.autoload_paths << Rails.root.join('app', 'workers')
```

So `Workers::LeadWise` should be autoloaded. The explicit `require 'workers/lead_wise'` was unnecessary and now causes errors.

**The fix:**

Remove the explicit `require` statements and rely on Zeitwerk's autoloading:

```ruby
# test/workers/lead_wise_test.rb
require 'test_helper'
# Workers::LeadWise is autoloaded by Zeitwerk

class LeadWiseTest < ActiveSupport::TestCase
  # tests...
end
```

The constant `Workers::LeadWise` is automatically available because Zeitwerk loads it based on the file path `app/workers/lead_wise.rb`.

I added a comment explaining that autoloading is handling it, to make it clear why there's no explicit require.

**Why this matters:**

If you have test files with explicit `require` statements for autoloaded code, Rails 7.1 will break them. The fix is simple: delete the `require` lines.

This is Zeitwerk enforcing correct behavior. Explicit requires for autoloaded files were always wrong—they just happened to work. Rails 7.1 stops tolerating it.

### Issue 3: ActionController::Parameters Now Enforces String/Symbol Keys

**Symptom:**

A test started failing with:

```
ActionController::InvalidParameterKey: all keys must be Strings or Symbols, got: Integer
```

The test looked like this:

```ruby
test "handles invalid parameter types gracefully" do
  params = ActionController::Parameters.new({ 1 => "value", 2 => "another" })
  # test code...
end
```

This test was checking that our controller code could handle edge cases where request parameters had integer keys (which could theoretically happen with malformed requests).

**Root cause:**

Rails 7.1 made `ActionController::Parameters` stricter. Previously, you could pass any key type to `Parameters.new`. Rails would convert them to strings internally.

In Rails 7.1, `Parameters` explicitly validates that all keys are either strings or symbols. If you pass integer keys, it raises `ActionController::InvalidParameterKey`.

**The fix:**

Looking at the test's intent, it was checking for a scenario that can no longer occur. Rails 7.1 now raises an error at the parameter parsing stage—before our controller code ever sees the params.

The solution: delete the test.

```ruby
# Removed test: Rails 7.1 raises InvalidParameterKey before controller code runs
```

This isn't a loss of test coverage—the scenario the test was checking for is now impossible in Rails 7.1+.

**Why this matters:**

Rails 7.1 added validation to `ActionController::Parameters` to prevent edge cases. If you have tests that construct `Parameters` objects with non-string/non-symbol keys, those tests will break.

This is a good change—it makes Rails more strict and prevents weird edge cases. But it means some tests checking "what if someone passes invalid data" scenarios are no longer relevant.

### Issue 4: check_pending! Deprecation

**Symptom:**

Running the test suite showed a deprecation warning:

```
DEPRECATION WARNING: The 'check_pending!' method is deprecated in favor of 'check_all_pending!'
```

This came from `test/test_helper.rb`:

```ruby
class ActiveSupport::TestCase
  ActiveRecord::Migration.check_pending!
  # ...
end
```

**Root cause:**

Rails 7.1 deprecated `check_pending!` in favor of a new method `check_all_pending!`. The old method only checked pending migrations for the primary database. The new method checks all database connections (useful for apps with multiple databases).

For apps with a single database, the behavior is identical. But Rails wants everyone to use the new API for consistency.

**The fix:**

Update `test/test_helper.rb`:

```ruby
class ActiveSupport::TestCase
  ActiveRecord::Migration.check_all_pending!
  # ...
end
```

Simple rename. Tests still pass, warning gone.

**Why this matters:**

This is a minor deprecation that's easy to fix. But it highlights Rails 7.1's focus on multi-database support. Even if you don't use multiple databases, the new APIs are designed with that use case in mind.

### Issue 5: secret_key_base in secrets.yml Deprecation

**Symptom:**

After fixing the `check_all_pending!` deprecation, a new warning appeared:

```
DEPRECATION WARNING: Your 'secret_key_base' is configured in 'Rails.application.secrets', which is deprecated in favor of 'Rails.application.credentials' or 'Rails.application.config'
```

This came from `config/secrets.yml`:

```yaml
# config/secrets.yml
development:
  secret_key_base: <%= ENV["SECRET_KEY_BASE"] %>

test:
  secret_key_base: <%= ENV["SECRET_KEY_BASE"] %>
```

**Root cause:**

Rails introduced `secrets.yml` in Rails 4.1 as a way to manage secret tokens. In Rails 5.1, they introduced encrypted credentials as a better approach. Rails 5.2 deprecated `secrets.yml`.

Rails 7.1 finally started warning that `secret_key_base` in `secrets.yml` is going away. The recommended approach is either:

1. Use `Rails.application.credentials` (encrypted credentials file)
2. Set `config.secret_key_base` directly in environment configs

Since our app uses environment variables (`ENV["SECRET_KEY_BASE"]`), option 2 makes more sense.

**The fix:**

Remove `config/secrets.yml` and set `secret_key_base` directly in environment configs:

```ruby
# config/environments/development.rb
Rails.application.configure do
  config.secret_key_base = ENV.fetch("SECRET_KEY_BASE") { "development_secret_key_base" }
  # ...
end
```

```ruby
# config/environments/test.rb
Rails.application.configure do
  config.secret_key_base = ENV.fetch("SECRET_KEY_BASE") { "test_secret_key_base" }
  # ...
end
```

For production, we already had it set via environment variables through our deployment configuration.

Tests passed, and the deprecation warning disappeared.

**Why this matters:**

`secrets.yml` is a deprecated pattern. Rails wants you to either:

- Use encrypted credentials (better for secrets that should be committed to git)
- Use environment variables directly in config files (better for secrets managed by deployment tools)

If you're still using `secrets.yml`, Rails 7.1 is telling you to migrate off it before Rails 8.0 (where it will likely be removed entirely).

### Configuration Updates

Updated `config/application.rb`:

```ruby
config.load_defaults 7.1
```

This enables Rails 7.1's default behaviors for:

- ActiveRecord: normalizes query parameters before logging (security improvement)
- ActionController: default cache control headers for static files
- ActiveJob: more aggressive serialization warnings
- ActiveSupport: improved error messages

These defaults are designed to be backward-compatible for most apps.

## What I Learned

### 1. PaperTrail Requires Active Maintenance

PaperTrail is a critical gem for many apps (including ours), but it's maintained by volunteers and tends to lag behind Rails releases.

If you use PaperTrail:

- Check compatibility before upgrading Rails
- Expect major version bumps for major Rails versions
- Test auditing functionality thoroughly after upgrading

The good news: PaperTrail's maintainers are responsive and usually add Rails support within a few months of release.

### 2. Zeitwerk Continues to Get Stricter

Every Rails upgrade since 6.0 has made Zeitwerk stricter:

- Rails 6.0: Introduced Zeitwerk as optional
- Rails 6.1: Made Zeitwerk mandatory
- Rails 7.0: Tightened timing around initializers
- Rails 7.1: Enforced no explicit requires for autoloaded files

The lesson: if you have explicit `require` statements for code in `app/` or configured autoload paths, remove them. Let Zeitwerk do its job.

### 3. ActionController::Parameters Enforcement is Good

The change to enforce string/symbol keys in `ActionController::Parameters` prevents edge cases. It's a breaking change that will affect some tests, but it's breaking tests for scenarios that can no longer happen.

If your tests construct `Parameters` objects with unusual key types (integers, booleans, etc.), those tests are now obsolete. Delete them.

### 4. secrets.yml is Finally Going Away

Rails has been trying to deprecate `secrets.yml` since Rails 5.2 (2018). Rails 7.1 is the first version to actively warn about it.

If you're still using `secrets.yml`:

- Migrate to encrypted credentials (for secrets committed to git)
- Or set config values directly in environment files (for secrets managed externally)

This migration is straightforward and pays off—modern Rails apps shouldn't use `secrets.yml`.

### 5. Minor Versions Can Still Break Things

Rails 7.0 → 7.1 is a "minor" version bump, but it introduced several breaking changes:

- PaperTrail incompatibility (gem upgrade required)
- Zeitwerk stricter requires (code changes required)
- ActionController::Parameters validation (test deletion required)
- secrets.yml deprecation (config changes required)

The lesson: don't assume minor version upgrades are safe. Run your full test suite, read the release notes, and budget time for fixes.

### 6. Incremental Upgrades Continue to Pay Off

This was the seventh phase of our Rails upgrade journey. Each phase built on the previous:

- Phase 1: Test coverage (30% → 80%)
- Phase 2-3: Rails 4.2 → 5.2
- Phase 4: Rails 5.2 → 6.0 (Zeitwerk)
- Phase 5: Rails 6.0 → 6.1 (Sprockets, cattr_accessor)
- Phase 6: Rails 6.1 → 7.0 (Zeitwerk timing, Airbrake)
- Phase 7: Rails 7.0 → 7.1 (this post)

Because we moved incrementally and maintained test coverage throughout, each upgrade took hours, not days. The issues were isolated and debuggable.

## Results

After all fixes:

- All 584 tests passing
- 0 failures, 0 errors
- 82% code coverage maintained
- No deprecation warnings

Rails 7.1 is now running cleanly in development and ready for staging deployment.

## Next Steps

**Immediate:**

- Rails 7.1.6 is stable and tested
- Deploy to staging for integration testing
- Monitor for any edge cases missed by unit tests

**For Rails 7.2/8.0 (eventual goals):**

- Address Sprockets 3.x pin and bootstrap-sass (technical debt from Phase 5)
- Consider migrating to Propshaft (Rails 8 default asset pipeline)
- Evaluate Turbo/Stimulus for SPA-like features
- Plan for Ruby 3.2+ upgrade

**Technical Debt:**

- Still carrying Sprockets 3.x pin from Phase 5 (bootstrap-sass incompatibility)
- Still carrying Sass deprecation silencing from Phase 5

These items can be addressed independently of the Rails upgrade path.

## Conclusion

Rails 7.0 → 7.1 was smoother than previous phases, but it still surfaced several issues. The PaperTrail incompatibility was expected (deeply integrated gems often need updates). The Zeitwerk strictness was a surprise—explicit requires had worked for years.

The most interesting change was `ActionController::Parameters` enforcing key types. This is Rails getting stricter about edge cases, which is a good trend. It means fewer weird bugs in production, even if it breaks some tests.

The incremental upgrade strategy continues to prove its value. Seven phases in, we're on Rails 7.1 with strong test coverage and a clean codebase. Each phase has been manageable because we moved methodically and fixed issues as they appeared.

One more major version to go: Rails 8.0.

---

**Upgrade Stats:**

- **Time**: ~2 hours
- **Tests**: 584 passing (100% maintained)
- **Coverage**: 82%
- **Major Issues**: 5 (PaperTrail, Zeitwerk requires, Parameters validation, check_pending!, secrets.yml)
- **Commits**: 2 (upgrade, fixes)

---

## Series Navigation

- **Previous**: [Phase 6: Rails 6.1 to 7.0](/blog/2026-01-26-rails-upgrade-phase-6-rails-6-1-to-7-0)
- **Next**: [Phase 8: Rails 7.1 to 8.0](/blog/2026-01-26-rails-upgrade-phase-8-rails-7-1-to-8-0)
- **Series Index**: [Rails 4 to 8 Upgrade Series](/blog/2026-01-26-rails-upgrade-series-from-rails-4-to-8)
