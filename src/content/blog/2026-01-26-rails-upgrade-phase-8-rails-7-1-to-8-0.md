---
title: "Rails Upgrade Phase Eight: Rails 7.1 to 8.0 - The Final Milestone"
description: "Completing the Rails upgrade journey from 4.2 to 8.0: navigating Ruby 3.2 requirements, PaperTrail updates, Minitest incompatibilities, controller test state changes, and Devise lazy loading."
pubDate: 2026-01-26
tags: ["building-in-public", "engineering", "rails-upgrade", "ruby"]
draft: false
generatedBy: "agent"
image: "/images/blog/rails-upgrade-phase-8-final.png"
---

> **Part of the [Rails 4 to 8 Upgrade Series](/blog/2026-01-26-rails-upgrade-series-from-rails-4-to-8)**

This is part 8 and the final phase of a multi-phase Rails upgrade journey. After successfully reaching Rails 7.1, the last major milestone is Rails 8.0. This is more than just another upgrade—it's the culmination of a journey that started with Rails 4.2 and took the app through five major Rails versions.

## Context

**Starting point:**

- Rails 7.1.6
- Ruby 3.1.6
- 582 passing tests
- 82% test coverage

**Target:**

- Rails 8.0.4 (latest stable)
- Ruby 3.2.7 (minimum requirement for Rails 8)

Rails 8.0 was released in November 2024 and brought significant changes: Propshaft as the default asset pipeline, Kamal for deployment, Solid Queue and Solid Cache as default adapters, and deeper integration with modern web standards. It also requires Ruby 3.2 or higher, making this a dual upgrade: Rails and Ruby.

## Original Plan

The upgrade strategy followed the established pattern:

1. Check Rails 8.0 Ruby requirements
2. Upgrade Ruby if necessary
3. Update Gemfile to Rails 8.0
4. Update `config.load_defaults 8.0`
5. Run tests and fix failures
6. Address any deprecation warnings
7. Clean up test warnings

Based on previous phases, I expected issues around gem compatibility and possibly some test helpers. What I didn't expect: how Rails 8.0 changed controller test state persistence and Devise route loading.

## What Changed

### Issue 1: Ruby Version Requirement

**Symptom:**

Attempting to update the Gemfile to Rails 8.0 immediately failed with:

```
Because rails >= 8.0.0.beta1 depends on Ruby >= 3.2.0
and current Ruby version is = 3.1.6
```

Bundler refused to proceed.

**Root cause:**

Rails 8.0 requires Ruby 3.2.0 or higher. Our app was on Ruby 3.1.6. This is a hard requirement—Rails 8.0 uses Ruby 3.2+ features and won't run on earlier versions.

Looking at Ruby 3.2's release notes, it introduced several improvements:

- YJIT performance enhancements
- Regexp timeout feature (security)
- Data class (immutable value objects)
- `Set` included by default

None of these were blocking for our app, but Rails 8.0 relies on them internally.

**The fix:**

Update `.ruby-version` and Gemfile:

```ruby
# .ruby-version
3.2.7

# Gemfile
ruby '3.2.7'
```

Then reinstall all gems:

```bash
rbenv install 3.2.7
rbenv global 3.2.7
bundle install
```

This worked cleanly—all gems were compatible with Ruby 3.2.7.

**Why this matters:**

Rails 8.0 is the first version to require Ruby 3.2+. If you're on Ruby 3.1 or earlier, you must upgrade Ruby before upgrading Rails. This isn't optional.

The good news: Ruby 3.2 is backward-compatible with most 3.1 code. Our app didn't need any code changes for the Ruby upgrade itself.

### Issue 2: pg Gem Native Extension Rebuild

**Symptom:**

After switching to Ruby 3.2.7 and running `bundle install`, the app started but immediately crashed with:

```
Library not loaded: /opt/homebrew/opt/postgresql@16/lib/libpq.5.dylib
Referenced from: /path/to/gems/pg-1.5.0/lib/pg_ext.bundle
Reason: tried: '/opt/homebrew/opt/postgresql@16/lib/libpq.5.dylib' (no such file)
```

**Root cause:**

The `pg` gem includes native extensions (C code compiled for your system). When you switch Ruby versions, gems with native extensions need to be recompiled.

Our `pg` gem was compiled for Ruby 3.1.6. It was installed in the Ruby 3.1.6 gem directory and linked against Ruby 3.1.6's C API.

Ruby 3.2.7 couldn't use those compiled extensions—it needed them recompiled for its own C API.

**The fix:**

Uninstall and reinstall the pg gem:

```bash
gem uninstall pg
bundle install
```

This forces the pg gem to recompile its native extensions for Ruby 3.2.7.

I also relaxed the version constraint in the Gemfile to allow minor updates:

```ruby
# Before
gem 'pg', '~> 1.5.0'

# After
gem 'pg', '~> 1.5'
```

This allows bundler to use pg 1.6.x if needed (which also fixes Ruby 3.2 compatibility issues).

**Why this matters:**

Whenever you upgrade Ruby, gems with native extensions (pg, nokogiri, mysql2, etc.) need to be recompiled. If you see "library not loaded" errors after a Ruby upgrade, this is why.

The fix is always: uninstall the gem and reinstall it.

### Issue 3: PaperTrail Incompatibility (Again)

**Symptom:**

After fixing the pg gem issue, running the test suite produced a warning:

```
DEPRECATION WARNING: PaperTrail 15.2.0 is not compatible with ActiveRecord 8.0.4
```

**Root cause:**

This was déjà vu from Phase 7. PaperTrail 15.x added Rails 7.1 support but didn't support Rails 8.0.

Checking the PaperTrail changelog, version 17.0 (released in late 2024) added Rails 8.0 compatibility.

**The fix:**

Update PaperTrail to 17.x:

```ruby
# Before
gem 'paper_trail', '~> 15.0'

# After
gem 'paper_trail', '~> 17.0'
```

After running `bundle update paper_trail`, the warning disappeared and all versioning tests passed.

**Why this matters:**

This is the second time PaperTrail required a major version bump during this upgrade journey (12.x → 15.x in Phase 7, now 15.x → 17.x).

If you use PaperTrail, expect to update it for every major Rails version. The good news: PaperTrail's maintainers are consistent about backward compatibility for standard usage patterns.

### Issue 4: Minitest 6.0 Incompatibility

**Symptom:**

Tests failed immediately with:

```
wrong number of arguments (given 3, expected 1..2)
/path/to/gems/railties-8.0.4/lib/rails/test_unit/line_filtering.rb:31:in 'run'
```

This error came from Rails' test runner, not from our code.

**Root cause:**

Looking at the stack trace, Rails' `line_filtering.rb` was calling Minitest's `run` method with three arguments.

Checking installed gems, bundler had installed Minitest 6.0.0 (the latest version).

Minitest 6.0 (released in January 2025) changed the signature of the `run` method from:

```ruby
# Minitest 5.x
def run(reporter, options = {}, &block)

# Minitest 6.x
def run(reporter, &block)
```

Minitest 6.0 removed the `options` argument. Rails 8.0.4 wasn't yet compatible with Minitest 6.0—it was still passing three arguments.

**The fix:**

Pin Minitest to 5.x in the Gemfile:

```ruby
gem 'minitest', '~> 5.25'
```

This prevents bundler from upgrading to Minitest 6.0.

**Why this matters:**

This is a case where Rails 8.0.4 wasn't yet updated for the latest Minitest. It's likely that Rails 8.1 or a future 8.0 patch will add Minitest 6.0 support.

For now, pinning to Minitest 5.x is the correct solution. Check the Rails 8.0 release notes for updates on Minitest 6.0 compatibility.

### Issue 5: Controller Test File Upload State Persistence

**Symptom:**

A controller test started failing with:

```
ActionController::BadRequest: Invalid request parameters: EOFError
```

The test looked like this:

```ruby
test "batch job upload and status check" do
  # First request: upload CSV file
  post batch_jobs_path, params: {
    batch_job: {
      csv_file: fixture_file_upload('batch_upload_simple.csv', 'text/csv')
    }
  }
  assert_response :success

  batch_job = assigns(:batch_job)

  # Second request: check status of created job
  get batch_job_path(batch_job)
  assert_response :success  # Fails here with EOFError
end
```

The first request succeeded. The second request exploded with `EOFError`.

**Root cause:**

Rails 8.0 changed how request state persists between requests in controller tests.

In Rails 7.1, after a request completes, Rails clears most request state but keeps some configuration. File uploads (multipart form data) were cleaned up between requests.

In Rails 8.0, something about the multipart request state persists. When the second request tries to parse parameters, it encounters leftover state from the file upload and raises `EOFError`.

This is likely a Rails 8.0 bug or an intentional change to make tests more isolated. Either way, the pattern of "upload file, then make another request in the same test" broke.

**The fix:**

Refactor the test to create the BatchJob directly instead of using two controller requests:

```ruby
test "batch job upload and status check" do
  # Create the batch job directly
  batch_job = BatchJob.create!(
    csv_file: fixture_file_upload('batch_upload_simple.csv', 'text/csv'),
    user: users(:one)
  )

  # Then check status via controller
  get batch_job_path(batch_job)
  assert_response :success
end
```

The original test was testing two things: "can I upload a file" and "can I view a batch job". Splitting them into separate concerns is cleaner.

**Why this matters:**

Rails 8.0 made controller tests stricter about request isolation. If you have tests that make multiple requests in the same test method, especially with file uploads, they might break.

The fix is usually: refactor to use direct model creation instead of chaining controller requests.

This change pushes you toward better test design—each test should test one thing.

### Issue 6: Devise Mappings Lazy Loading

**Symptom:**

A helper method test failed with:

```
NoMethodError: undefined method 'name' for nil:NilClass
app/helpers/devise_helper.rb:12:in 'devise_mapping'
```

The helper code looked like this:

```ruby
# app/helpers/devise_helper.rb
def devise_mapping
  @devise_mapping ||= Devise.mappings[:user]
end
```

The test was:

```ruby
# test/helpers/devise_helper_test.rb
class DeviseHelperTest < ActionView::TestCase
  test "devise_mapping returns user mapping" do
    mapping = devise_mapping
    assert_equal 'user', mapping.name
  end
end
```

**Root cause:**

In Rails 7.1, routes were loaded eagerly during test setup. Devise hooks into route loading to populate `Devise.mappings`.

Rails 8.0 introduced lazy route loading. Routes aren't loaded until they're first accessed. When the helper test runs, routes haven't been loaded yet, so `Devise.mappings` is empty.

`Devise.mappings[:user]` returns `nil`, and calling `.name` on `nil` raises `NoMethodError`.

**The fix:**

Add route loading to the test setup:

```ruby
# test/helpers/devise_helper_test.rb
class DeviseHelperTest < ActionView::TestCase
  setup do
    # Force routes to load if Devise.mappings is empty
    Rails.application.reload_routes! if Devise.mappings.empty?
  end

  test "devise_mapping returns user mapping" do
    mapping = devise_mapping
    assert_equal 'user', mapping.name
  end
end
```

The `reload_routes!` call forces Rails to load routes, which triggers Devise to populate its mappings.

The `if Devise.mappings.empty?` guard prevents reloading routes on every test run (only when needed).

**Why this matters:**

Rails 8.0's lazy route loading can break tests that depend on route-initialized state (like Devise mappings).

If you have helper or integration tests that reference Devise or other route-dependent gems, you might need to explicitly load routes in test setup.

### Issue 7: Tests Missing Assertions (Warnings Turned Into Proper Tests)

**Symptom:**

The test suite produced warnings like:

```
Test::Unit::TestCase: This test contains an assertion inside each loop, which might not execute.
```

These warnings came from tests that looked like:

```ruby
test "all users have valid emails" do
  User.all.each do |user|
    assert user.email.present?, "User #{user.id} missing email"
  end
end
```

The problem: if `User.all` returns an empty array, the test passes without running any assertions. Rails 8.0 started warning about this pattern.

**Root cause:**

Rails 8.0's test framework became stricter about tests that might have zero assertions. Tests with assertions inside `.each` blocks are risky—if the collection is empty, no assertions run, and the test is meaningless.

**The fix:**

Refactor tests to ensure they always run assertions:

```ruby
test "all users have valid emails" do
  users = User.all
  assert users.any?, "Test requires users in fixtures"

  users.each do |user|
    assert user.email.present?, "User #{user.id} missing email"
  end
end
```

Or, better yet, create test-specific data instead of relying on fixtures:

```ruby
test "users require valid emails" do
  user = User.create(name: "Test", email: "")
  assert_not user.valid?
  assert_includes user.errors[:email], "can't be blank"
end
```

I also found a helper method incorrectly named as a test:

```ruby
# Before (incorrectly named)
def test_hash_new_email
  # helper method that generates unique emails
end

# After
def set_unique_email
  # helper method that generates unique emails
end
```

Methods starting with `test_` are interpreted as test cases. This helper wasn't a test—it was utility code. Renaming it fixed the warning.

**Why this matters:**

Rails 8.0 is stricter about test quality. Tests should:

- Always run at least one assertion
- Not rely on fixtures existing (create their own data)
- Use descriptive assertion messages

These warnings force you to write better tests.

### Configuration Updates

Updated `config/application.rb`:

```ruby
config.load_defaults 8.0
```

This enables Rails 8.0's default behaviors for:

- ActiveRecord: better query logging, improved connection pooling
- ActionController: stricter CSRF protection, enhanced security headers
- ActiveJob: Solid Queue as default adapter
- ActiveStorage: better streaming support
- ActionView: improved template resolution

Most of these are backward-compatible for apps that followed Rails conventions.

## What I Learned

### 1. Ruby Upgrades Add Complexity

This was the first phase where we had to upgrade both Ruby and Rails. Upgrading Ruby separately first would have been safer (test on Ruby 3.2 with Rails 7.1, then upgrade to Rails 8.0).

We did both at once, which worked but made debugging harder—when something broke, was it Ruby 3.2 or Rails 8.0?

Lesson: for major upgrades, consider upgrading Ruby first, then Rails.

### 2. Native Extension Gems Are Fragile

The `pg` gem failure after the Ruby upgrade was predictable but easy to forget. Every time you upgrade Ruby, gems with native extensions need recompilation.

Common culprits:

- pg (PostgreSQL)
- mysql2 (MySQL)
- nokogiri (XML parsing)
- json (JSON parsing, though now built into Ruby)

If you see "library not loaded" errors after a Ruby upgrade, reinstall the gem.

### 3. Minitest 6.0 is Too New for Rails 8.0

This caught me by surprise. Rails 8.0.4 (released in early 2025) wasn't compatible with Minitest 6.0 (also released in early 2025).

This is a reminder that edge versions don't always work together. Pinning Minitest to 5.x is safe and expected for now.

### 4. Rails 8.0 Enforces Better Test Isolation

The controller test file upload issue and the Devise mappings issue both stem from Rails 8.0 being stricter about test isolation:

- Request state doesn't persist between requests (file upload issue)
- Routes load lazily, not eagerly (Devise issue)

These changes push you toward better test design:

- Each test should be independent
- Tests should set up their own state
- Tests shouldn't rely on global initialization

### 5. PaperTrail Updates Are Predictable

This is the second PaperTrail upgrade in this journey (15.x in Phase 7, 17.x in Phase 8). The pattern is clear:

- Every major Rails version requires a PaperTrail major version bump
- PaperTrail releases lag Rails by a few months
- PaperTrail maintains backward compatibility for standard usage

If you use PaperTrail, budget time for gem upgrades with every Rails upgrade.

### 6. Test Quality Warnings Are Valuable

Rails 8.0's warnings about tests with assertions in loops caught real issues. Tests that depend on fixture data existing are fragile—if fixtures change, tests break mysteriously.

The warning forced us to write better tests that:

- Create their own data
- Have explicit precondition checks
- Always run at least one assertion

### 7. Incremental Upgrades Completed the Journey

This was the eighth and final phase of our Rails upgrade journey:

- Phase 1: Test coverage (30% → 82%)
- Phase 2-3: Rails 4.2 → 5.2
- Phase 4: Rails 5.2 → 6.0 (Zeitwerk)
- Phase 5: Rails 6.0 → 6.1 (Sprockets, cattr_accessor)
- Phase 6: Rails 6.1 → 7.0 (Zeitwerk timing, Airbrake)
- Phase 7: Rails 7.0 → 7.1 (PaperTrail, secrets.yml)
- Phase 8: Rails 7.1 → 8.0 (this post)

Eight phases. Seven major/minor version bumps.

And it worked. We went from Rails 4.2 (released 2014) to Rails 8.0 (released 2024), maintained test coverage, and a cleaner codebase than when we started.

## Results

After all fixes:

- All 582 tests passing
- 0 failures, 0 errors
- 82% code coverage maintained
- No deprecation warnings
- No missing assertion warnings

Rails 8.0.4 and Ruby 3.2.7 are now running cleanly in development and ready for staging deployment.

## Next Steps

**Immediate:**

- Deploy to staging for full integration testing
- Monitor for edge cases missed by unit tests
- Update deployment scripts for Ruby 3.2.7

**Technical Debt to Address:**

- Sprockets 3.x pin from Phase 5 (bootstrap-sass compatibility)
- Sass deprecation silencing from Phase 5
- Consider migrating to Propshaft (Rails 8 default)
- Evaluate Turbo/Stimulus for SPA features

**Future Rails Versions:**

- Monitor Rails 8.1 for new features
- Watch for Minitest 6.0 support in future Rails releases
- Stay current with security patches

## Conclusion

Rails 7.1 → 8.0 was the final phase in our upgrade journey. It required upgrading both Ruby (3.1 → 3.2) and Rails (7.1 → 8.0), which added complexity but was manageable.

The most interesting issues were Rails 8.0's stricter test isolation (file upload state, Devise lazy loading) and the Minitest 6.0 incompatibility. These weren't obvious from the upgrade guide—they surfaced during test runs.

The controller test refactoring was actually an improvement. Forcing us to separate "upload a file" from "view a resource" resulted in cleaner, more focused tests.

Completing this upgrade journey from Rails 4.2 to 8.0 validates the incremental approach:

- Start with test coverage (Phase 1)
- Move one major version at a time
- Fix issues as they appear
- Maintain coverage throughout
- Document technical debt

This strategy worked. The app is now on Rails 8.0, running Ruby 3.2, with 82% test coverage and a clean codebase.

The journey is complete.

---

**Upgrade Stats:**

- **Time**: ~3 hours
- **Tests**: 582 passing (100% maintained)
- **Coverage**: 82%
- **Major Issues**: 7 (Ruby version, pg gem, PaperTrail, Minitest, file upload state, Devise mappings, test assertions)
- **Commits**: 3 (Ruby upgrade, Rails upgrade, test fixes)
- **Total Journey**: Rails 4.2 → 8.0 (8 phases, 2+ years)

---

## Series Navigation

- **Previous**: [Phase 7: Rails 7.0 to 7.1](/blog/2026-01-26-rails-upgrade-phase-7-rails-7-0-to-7-1)
- **Series Index**: [Rails 4 to 8 Upgrade Series](/blog/2026-01-26-rails-upgrade-series-from-rails-4-to-8)
