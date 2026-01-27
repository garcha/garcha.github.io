---
title: "Rails Upgrade Phase Two, Three, :Rails Upgrade, The Hidden Costs of Rails 5.2"
description: "Ten production-breaking changes we hit upgrading from Rails 5.0 to 5.2, from belongs_to requirements to DataTables incompatibilities"
pubDate: 2026-01-23
tags: ["building-in-public", "engineering", "rails", "rails-upgrade"]
draft: false
generatedBy: "agent-edited"
image: "/images/blog/rails-upgrade-phase-2-3-rails5.png"
---

> **Part of the [Rails 4 to 8 Upgrade Series](/blog/2026-01-26-rails-upgrade-series-from-rails-4-to-8)**

This is Part 2 of our Rails 4.2 → Rails 8 upgrade series. We tackled the jump from 4.2 to 5.0. This post covers Phase 3: Rails 5.0 → 5.2.

The official Rails upgrade guides make this look straightforward. They're not wrong, exactly—but they miss the second-order effects. The small API changes that cascade through your application in unexpected ways.

Here's what actually broke.

## Context

We're upgrading a production task management system. Rails 4.2 → 5.0 went reasonably well. The test suite was passing. We thought 5.0 → 5.2 would be incremental.

It wasn't.

## The Plan

Standard Rails upgrade procedure:

1. Update Gemfile to Rails 5.2
2. Run `bundle update`
3. Fix deprecation warnings
4. Run tests
5. Manual smoke testing

Steps 1-3 went fine. Step 4 revealed problems. Step 5 revealed _more_ problems that tests didn't catch.

## What Broke

### 1. belongs_to Associations Now Required by Default

**Symptom:** Test suite exploded with validation errors on save.

Rails 5 made `belongs_to` associations required by default. Previously, you could save a model with a nil foreign key. Now it fails validation unless you explicitly allow it.

**The fix:** Add `optional: true` to associations that can be nil.

`app/models/task_entry.rb`:

```ruby
class Task < ApplicationRecord
  belongs_to :entry_class, optional: true
  belongs_to :payment_history, optional: true
  belongs_to :user, optional: true
  # ...
end
```

`app/models/user.rb`:

```ruby
class User < ApplicationRecord
  belongs_to :task_set, optional: true
  # ...
end
```

This affected multiple models. The pattern: anywhere you had a nullable foreign key, you now needed explicit `optional: true`.

**Why this matters:** This is a good change—it makes implicit assumptions explicit. But it requires auditing every `belongs_to` in your codebase. Miss one and you get runtime errors in production.

### 2. SQLite Boolean Representation Changed

**Symptom:** Boolean queries started returning unexpected results in development.

Rails 5.2 changed how SQLite stores booleans: from `'t'/'f'` strings to `1/0` integers. Existing data stored as strings broke queries.

**The fix:** Tell Rails to keep using the old representation.

`config/initializers/sqlite_boolean.rb`:

```ruby
Rails.application.config.active_record.sqlite3.represent_boolean_as_integer = false
```

This preserves backward compatibility with existing SQLite data. Production uses PostgreSQL, but development/test environments broke without this.

### 3. SCSS File Naming Convention

**Symptom:** 22 deprecation warnings about `.css.scss` extensions.

Rails stopped supporting the `.css.scss` extension. Files need to be `.scss` only.

**The fix:** Bulk rename.

```bash
# Renamed all files matching *.css.scss to *.scss
find app/assets/stylesheets -name "*.css.scss" -exec rename 's/\.css\.scss$/.scss/' {} \;
```

Also updated imports in `application.scss` to remove the `.css` prefix.

Trivial change, but 22 files meant 22 potential typos if done manually.

### 4. CSRF and Cookie Authentication Broke Login

**Symptom:** Login form stopped working after upgrade. Session cookies not persisting. CSRF token mismatches.

This was the nastiest issue. Three interconnected problems:

#### Problem 4a: Cookie Serializer Format

Rails changed default cookie serializer from Marshal to JSON. Existing sessions couldn't be read.

**First attempt:** Set serializer to `:marshal` in `config/initializers/cookies_serializer.rb`.

This broke Devise. Devise needs JSON serializer for security.

**Actual fix:** Use `:hybrid` serializer.

```ruby
Rails.application.config.action_dispatch.cookies_serializer = :hybrid
```

Hybrid mode reads both Marshal (old cookies) and JSON (new cookies), writes JSON. Allows gradual migration.

#### Problem 4b: CSRF Protection Strategy

Our `ApplicationController` had:

```ruby
protect_from_forgery with: :null_session
```

This silently clears the session on CSRF failure. Sounds defensive, but it meant login failures gave no error—just a blank page reload.

**The fix:** Use exception mode and prepend.

```ruby
protect_from_forgery with: :exception, prepend: true
```

Now CSRF failures raise an error we can debug. The `prepend: true` runs CSRF check before other callbacks.

#### Problem 4c: Devise Session Controller CSRF

Even with the above, login still failed. Turns out Devise's session controller needs to skip CSRF verification for the login action itself (since the user isn't authenticated yet to have a valid token).

**The fix:** Create a custom session controller.

`app/controllers/users/sessions_controller.rb`:

```ruby
class Users::SessionsController < Devise::SessionsController
  skip_before_action :verify_authenticity_token, only: [:create]
end
```

Updated routes:

```ruby
devise_for :users, controllers: { sessions: 'users/sessions' }
```

These three changes together fixed login. But debugging this took hours because the symptoms (blank page, no error) gave few clues.

### 5. CarrierWave Image Paths Changed

**Symptom:** Profile images displayed as `#<CarrierWave::Storage::File::File:0x00007f8b1c>` instead of URLs.

CarrierWave changed what `image.path` returns. It used to return the URL string. Now it returns the uploader object itself.

**The fix:** Call `.url` explicitly.

Before:

```erb
<%= image_tag current_user.image.path %>
```

After:

```erb
<%= image_tag current_user.image.path.url %>
```

Or better yet, just use `current_user.image.url` directly.

### 6. Turbolinks 5 Event Name Changes

**Symptom:** JavaScript that ran on page load stopped working.

Turbolinks 5 renamed events:

- `page:load` → `turbolinks:load`
- `page:change` → `turbolinks:render`

**The fix:** Global find/replace across JavaScript files.

```javascript
// Before
$(document).on('page:load', function() { ... });

// After
$(document).on('turbolinks:load', function() { ... });
```

Affected multiple files:

- `app/assets/javascripts/application.js`
- `app/assets/javascripts/task_entries.js`
- `app/assets/javascripts/task_sets.js`
- Several others

### 7. JavaScript Button Event Handlers Stopped Firing

**Symptom:** Show/Delete buttons on the task entries table stopped working.

We had JavaScript-based button handlers using event delegation:

```javascript
$(document).on("click", ".show-entry-btn", function () {
  window.location = $(this).data("url");
});

$(document).on("click", ".delete-entry-btn", function () {
  if (confirm("Are you sure?")) {
    // Ajax delete
  }
});
```

After the upgrade, these events stopped firing. Not clear why—possibly a jQuery/Turbolinks interaction.

**The fix:** Replace with Rails convention.

Instead of JavaScript event handlers, use Rails' built-in link helpers:

```erb
<!-- Before: button with data-url and JavaScript handler -->
<button class="show-entry-btn" data-url="<%= task_entry_path(entry) %>">Show</button>

<!-- After: standard Rails link -->
<%= link_to 'Show', task_entry_path(entry), class: 'btn btn-sm btn-info' %>
```

For delete:

```erb
<!-- Before: button with JavaScript confirm/ajax -->
<button class="delete-entry-btn" data-id="<%= entry.id %>">Delete</button>

<!-- After: Rails link with method: :delete -->
<%= link_to 'Delete', task_entry_path(entry),
    method: :delete,
    data: { confirm: 'Are you sure?' },
    class: 'btn btn-sm btn-danger' %>
```

Rails handles the confirmation dialog and DELETE request automatically. Less custom code, more maintainable.

### 8. DataTables ResponsiveDatatablesHelper Removed

**Symptom:** `NameError: uninitialized constant ResponsiveDatatablesHelper`

We used `jquery-datatables-rails` gem version 2.2.3. The upgrade to Rails 5.2 required bumping to 3.4.0. This removed the `ResponsiveDatatablesHelper` class entirely.

**The fix:** Replace custom helper with built-in option.

Before (`app/datatables/task_set_datatable.rb`):

```ruby
class TaskSetDatatable < AjaxDatatablesRails::Base
  include ResponsiveDatatablesHelper
  # ...
end
```

After:

```ruby
class TaskSetDatatable < AjaxDatatablesRails::ActiveRecord
  # No include needed
end
```

In the view, add `responsive: true` option:

```javascript
$("#task-sets-table").DataTable({
  responsive: true,
  // ... other options
});
```

The responsive behavior is now built into DataTables itself—no custom Rails helper needed.

### 9. ajax-datatables-rails Params Compatibility

**Symptom:** DataTables table rendering broke with `NoMethodError: undefined method 'each' for nil:NilClass` in `aggregate_query`.

The `ajax-datatables-rails` gem expects a `params[:columns]` hash. But in some scenarios (initial page load?), this was nil.

**The fix:** Override `aggregate_query` to handle nil params.

`app/datatables/task_set_datatable.rb`:

```ruby
class TaskSetDatatable < AjaxDatatablesRails::ActiveRecord
  # ...

  def aggregate_query
    return @records if params[:columns].blank?
    super
  end
end
```

If `params[:columns]` is missing, just return the base query. Otherwise call the parent implementation.

This feels like a gem bug (it should handle nil gracefully), but the workaround is simple.

### 10. rejection_reasons Returning nil Instead of Empty Array

**Symptom:** View rendering errors on `rejection_reasons.each`.

The `rejection_reasons` method fetched data from a `GithubContent` model. If the record didn't exist, it returned `nil`. Views expected an array.

**The fix:** Return empty array as fallback.

Before:

```ruby
def rejection_reasons
  GithubContent.find_by(name: 'rejection_reasons')&.data
end
```

After:

```ruby
def rejection_reasons
  GithubContent.find_by(name: 'rejection_reasons')&.data || []
end
```

Simple nil-guarding. The `&.` (safe navigation) prevents errors if the record is missing, and `|| []` ensures we always return an enumerable.

## What I Learned

**1. Test coverage matters, but so does production-like testing.**

Our test suite was at 80% coverage. All tests passed after the belongs_to fixes. But login was still broken. Why? Because we didn't have integration tests that actually exercised the full authentication flow with cookies and CSRF tokens.

Unit tests catch logic errors. Integration tests catch plumbing errors.

**2. Deprecation warnings are not optional.**

We ignored some deprecation warnings in Rails 5.0. By Rails 5.2, those deprecated features were removed entirely. The warnings _are_ the upgrade guide.

Fix them immediately, or document why you're deferring them.

**3. Gem upgrades are part of Rails upgrades.**

Rails 5.2 required newer versions of:

- `jquery-datatables-rails` (2.2.3 → 3.4.0)
- `ajax-datatables-rails` (0.3.1 → 0.4.3)
- `devise` (4.2 → 4.7)
- `carrierwave` (1.0 → 2.1)

Each gem upgrade brought its own breaking changes. You're not just upgrading Rails—you're upgrading the ecosystem.

**4. Cookie/session issues are the worst to debug.**

No stack trace. No error message. Just "it doesn't work." These issues require methodical elimination:

- Check browser DevTools → Application → Cookies
- Check browser DevTools → Network → Headers for CSRF tokens
- Add `byebug` to controller actions to inspect session state
- Test with CSRF protection disabled to isolate the issue

## Next Steps

Rails 5.2 is now stable. All tests pass. Manual testing shows no obvious breakage.

Phase 4: Rails 5.2 → 6.0. This is where Zeitwerk (the new autoloader) enters. I expect namespace and constant loading issues.

Also on the radar:

- Migrate remaining `.css.scss` references in gems/vendor code
- Add integration tests for authentication flows
- Audit all `belongs_to` associations—some might actually be required and shouldn't be `optional: true`

## Appendix: File Changes Summary

**Time spent:** ~8 hours (includes debugging, testing, iteration)

**Tests:** All passing (80% coverage)

---

_This is part of an ongoing series documenting our Rails 4.2 → Rails 8 upgrade. The goal is to share the real costs and complexity of maintaining a Rails app through major version changes._

---

## Series Navigation

- **Previous**: [Phase 1: Test Coverage First](/blog/2026-01-22-rails-upgrade-test-coverage-first)
- **Next**: [Phase 4: Rails 6.0 (Zeitwerk, Apple Silicon, Ruby 3)](/blog/2026-01-26-rails-6-upgrade-surviving-zeitwerk-apple-silicon-and-ruby-3)
- **Series Index**: [Rails 4 to 8 Upgrade Series](/blog/2026-01-26-rails-upgrade-series-from-rails-4-to-8)
