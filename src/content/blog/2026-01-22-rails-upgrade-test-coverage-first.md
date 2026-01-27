---
title: "Rails Upgrade Phase One: of Upgrading a Legacy Rails App: Test Coverage First"
description: "How we improved test coverage from 30% to 80% before upgrading a Rails 4.2 application, and why that foundation made all the difference."
pubDate: 2026-01-22
tags: ["building-in-public", "engineering", "rails", "testing", "legacy-code"]
draft: false
generatedBy: "agent-edited"
image: "/images/blog/rails-upgrade-phase-1-tests.png"
---

> **Part of the [Rails 4 to 8 Upgrade Series](/blog/2026-01-26-rails-upgrade-series-from-rails-4-to-8)**

## Context

I'm upgrading a Rails 4.2 application that's been running in production for years. This isn't just any upgrade—it's a journey from Rails 4.2 all the way to Rails 8.0. That's seven major version jumps spanning nearly a decade of framework evolution.

The codebase has all the hallmarks of a mature legacy app: a mix of modern and deprecated patterns, gems that haven't been updated in years, and test coverage that was... optimistic at best. When I started, roughly 30% of the code had test coverage, and a significant portion of the tests that did exist were failing.

Here's the thing about Rails upgrades: if you don't have a solid test suite, you're flying blind. Every change becomes a potential minefield. Every deprecated API could be hiding in some forgotten corner of your codebase. Every "small refactor" could break production in ways you won't discover until users start complaining.

So before touching the Rails version, I made a decision: **fix the test suite first**.

## Original Plan

The upgrade plan was clear from the start. Looking at the Rails version matrix, the path forward was:

```
4.2 → 5.0 → 5.2 → 6.0 → 6.1 → 7.0 → 7.1 → 8.0
```

But before any of that, Phase 0: Test Infrastructure. The plan was straightforward:

1. Add SimpleCov to measure code coverage
2. Replace Poltergeist (a deprecated PhantomJS driver) with Selenium and headless Chrome
3. Fix the Devise test helper deprecations
4. Get the test suite passing
5. Establish a baseline coverage percentage

Only then would we start touching Rails versions.

## What Changed

### The Reality of Legacy Test Suites

When I first ran the test suite, it was a mess. Not in a "few tests are failing" way, but in a "the test infrastructure itself is broken" way.

**The Poltergeist Problem**: The app was using Poltergeist, which depends on PhantomJS—a headless browser that was discontinued in 2018. The tests would sometimes pass, sometimes fail, and the failures were cryptic. Worse, there was a custom `test_silence_poltergeist.rb` file whose entire purpose was to suppress Poltergeist's noisy output. That's never a good sign.

**Devise Test Helpers**: The test suite was using `Devise::TestHelpers`, which was deprecated in Devise 4.2 (released in 2016). Every single controller test was including the old helper, generating deprecation warnings that cluttered the output.

**Test Organization**: The app had 60+ test files totaling over 8,600 lines of test code. Some files had hundreds of lines of tests. Others had barely any. The coverage was inconsistent, and it wasn't clear what was actually being tested.

### The Coverage Reality Check

After adding SimpleCov and getting it working, the initial numbers were sobering:

- **30% line coverage** - meaning 70% of the code had never been executed in a test
- Tests were scattered and inconsistent
- Many critical code paths had zero coverage

But here's what surprised me: even with 30% coverage, the app had 575 test runs. That's not nothing. The problem wasn't a lack of tests—it was that the tests weren't comprehensive, and many of them were failing or skipped.

## Iterations & Fixes

### Iteration 1: Modernizing the Test Infrastructure

**Replacing Poltergeist with Selenium**

This was the first major fix. I ripped out Poltergeist entirely and replaced it with Selenium WebDriver using headless Chrome:

```ruby
# test/test_helper.rb
require 'selenium/webdriver'

Capybara.register_driver :headless_chrome do |app|
  options = Selenium::WebDriver::Chrome::Options.new
  options.add_argument('--headless')
  options.add_argument('--no-sandbox')
  options.add_argument('--disable-gpu')
  options.add_argument('--disable-dev-shm-usage')
  options.add_argument('--window-size=1400,1400')

  Capybara::Selenium::Driver.new(app, browser: :chrome, options: options)
end

Capybara.default_driver = :rack_test
Capybara.javascript_driver = :headless_chrome
```

The key insight here: use `:rack_test` by default (it's much faster) and only use headless Chrome for JavaScript tests. This made the test suite run significantly faster while maintaining the ability to test JavaScript-heavy features.

**Fixing Devise Test Helpers**

This was a simple find-and-replace, but it eliminated hundreds of deprecation warnings:

```ruby
# Before
class ActionController::TestCase
  include Devise::TestHelpers
end

# After
class ActionController::TestCase
  include Devise::Test::ControllerHelpers
end
```

Small change, massive improvement in signal-to-noise ratio when running tests.

### Iteration 2: Setting Up Coverage Tracking

Adding SimpleCov was straightforward, but it had to be configured carefully:

```ruby
# test/test_helper.rb - MUST be at the very top
require 'simplecov'
SimpleCov.start 'rails' do
  add_filter '/test/'
  add_filter '/config/'
  add_filter '/vendor/'
end
```

The critical detail: SimpleCov must be required **before** any application code loads. If you require it after `config/environment`, your coverage will be incomplete.

### Iteration 3: Handling External Dependencies

One of the sneakier issues was external service dependencies. The app integrated with:

- AWS S3 for file uploads
- PayPal for payments
- RabbitMQ for background jobs
- Salesforce for CRM integration

Tests were failing because they were trying to make real HTTP requests to these services. The solution was a combination of VCR, WebMock, and strategic stubbing:

```ruby
# Stub S3/AWS requests to avoid SSL/credential issues in tests
WebMock.stub_request(:any, /\.amazonaws\.com/)
  .to_return(status: 204, body: '', headers: {})

# Skip PayPal tests by default
ENV['SKIP_PAYPAL'] ||= '1' unless ENV['RUN_PAYPAL_TESTS']

# Mock Sneakers/RabbitMQ since we don't have it in test
module Sneakers
  def self.logger
    Rails.logger
  end

  def self.message_count(queue_name)
    0
  end
end
```

This allowed tests to run without requiring a full environment setup with all external services.

### Iteration 4: Writing Missing Tests

With the infrastructure stable, I started filling in the coverage gaps. The strategy was pragmatic:

1. **Controllers first**: These are the entry points to your application. If a controller action has no test, you have no confidence it works.
2. **Critical models**: Focus on models with complex business logic, especially around payments, user management, and data validation.
3. **Integration tests**: Add tests for complete user flows (signup, task submission, review process, payment).

I didn't try to get to 100% coverage. Instead, I focused on:

- Every controller action should have at least one test
- Every model method that's actually used should have a test
- Every critical user flow should have an integration test

The result? Coverage went from 30% to 80%.

### Iteration 5: Updating Test Syntax for Rails 5

Even though we were still on Rails 4.2, I knew Rails 5 was next. One of the major changes in Rails 5 is controller test syntax. So I proactively updated tests to use the new keyword argument style:

```ruby
# Old Rails 4.2 style
get :index, set: 1234, format: :json
post :create, task_entry: { name: 'test' }

# New Rails 5+ style
get :index, params: { set: 1234 }, format: :json
post :create, params: { task_entry: { name: 'test' } }
```

This meant when we actually upgraded to Rails 5, the tests wouldn't explode.

## What I Learned

### 1. Test Infrastructure is a Dependency

Your test suite has dependencies just like your application. When those dependencies are deprecated or unmaintained (like PhantomJS/Poltergeist), your entire testing strategy becomes fragile.

Lesson: **Treat test infrastructure with the same care as production dependencies.** If a test dependency is showing deprecation warnings or hasn't been updated in years, replace it proactively.

### 2. Coverage Percentage is a Guide, Not a Goal

Going from 30% to 80% coverage sounds impressive, but the percentage itself doesn't tell the whole story. What mattered more was:

- **Which** code is covered (controllers and critical business logic)
- **How** it's covered (meaningful assertions, not just executing code)
- **What** scenarios are tested (happy path, edge cases, error handling)

I have 80% coverage, but I'm sure there are edge cases not covered. And that's okay. The goal was confidence, not perfection.

### 3. Failing Tests are Worse Than No Tests

When I started, about 15% of the test suite was either failing or skipped. This is worse than having no tests because:

- Developers stop trusting the test suite
- CI becomes meaningless (if it's always red, nobody pays attention)
- Broken tests create learned helplessness ("tests are always broken, so I don't bother")

Lesson: **A passing test suite is the minimum viable state.** If your tests aren't passing, stop everything and fix them first. You can't build on a broken foundation.

### 4. The Rails 5 Controller Syntax Change is Annoying but Important

Rails 5 changed controller test syntax to use keyword arguments. This seems like a small thing, but it affects literally every controller test. If you have hundreds of controller tests (like we did), updating them all at once is painful.

The smart move: update them proactively before upgrading Rails. You'll get deprecation warnings in Rails 4.2, but the tests will still work. Then when you upgrade to Rails 5, the tests just... work.

### 5. Test Speed Matters

The initial test suite took over minutes to run. After switching from Poltergeist to Selenium and optimizing the Capybara setup, it dropped to around 50 seconds for the full suite.

Why does this matter? Because developers run tests frequently. If tests take minutes, you're more likely to skip running them. At 50 seconds, there's no excuse.

### 6. External Service Mocking is Non-Negotiable

Tests that depend on external services (APIs, databases, message queues) are fragile by definition. They fail for reasons unrelated to your code:

- Network issues
- Service downtime
- Rate limits
- Authentication changes

The solution: mock external services in tests using VCR, WebMock, or direct stubbing. Your tests should be hermetic—they should run anywhere, anytime, without external dependencies.

### 7. Documentation is Part of Testing

One unexpected benefit: while writing tests, I discovered code that nobody understood anymore. There were features that had been deployed years ago, and the original developers were long gone. The tests became documentation.

Example: I found a complex workflow around "batch uploads" that had zero documentation. By writing integration tests for it, I documented how it's supposed to work. Future developers (including future me) will thank me.

## Current State

Today, the test suite is stable:

- ✅ 575 test runs, 2,083 assertions
- ✅ 0 failures, 0 errors
- ✅ 80.84% line coverage (2,282 / 2,823 lines)
- ✅ All deprecated test infrastructure removed
- ✅ Modern Selenium + headless Chrome for browser tests
- ✅ VCR + WebMock for external API mocking
- ✅ Tests run in ~50 seconds

The test suite now generates deprecation warnings for controller syntax, but that's intentional. These warnings will guide the Rails 4.2 → 5.0 upgrade.

## Next Steps

Now that we have a stable test foundation:

1. **Fix remaining deprecations** - Replace `before_filter` with `before_action` throughout the codebase
2. **Update Rails to 5.0** - The first major version jump, enabled by our test coverage
3. **Monitor coverage** - As we add new features, maintain the 80%+ coverage threshold
4. **Incremental upgrades** - Move through Rails 5.2 → 6.0 → 6.1 → 7.0 → 7.1 → 8.0

Each upgrade will be validated by the test suite. If tests pass after an upgrade, we have high confidence nothing broke. If tests fail, we know exactly what to fix.

## Key Takeaways

If you're facing a legacy Rails upgrade:

1. **Start with tests** - Before upgrading anything, get your test suite passing and measure coverage
2. **Modernize test infrastructure** - Replace deprecated tools (Poltergeist, old test helpers) with modern equivalents
3. **Mock external dependencies** - Use VCR, WebMock, or stubs to make tests fast and reliable
4. **Focus on critical paths** - You don't need 100% coverage, but you do need coverage of controllers, critical business logic, and key user flows
5. **Update test syntax proactively** - If you know the next Rails version changes test syntax, update it now while you're on the old version
6. **Make tests fast** - Slow tests don't get run. Fast tests enable confidence.
7. **Document as you test** - Tests are documentation. Write them with future developers in mind.

The Rails upgrade journey is long, but with a solid test foundation, it's manageable. Each version bump is validated by hundreds of tests that give us confidence we haven't broken critical functionality.

**Test coverage isn't the goal—confidence is.** Tests are the tool that gives you confidence to make big changes without fear.

Now, on to Rails 5.0.

---

## Series Navigation

- **Next**: [Phase 2 & 3: Rails 5.0 to 5.2](/blog/2026-01-23-rails-upgrade-part-2-fixing-rails-52-compatibility)
- **Series Index**: [Rails 4 to 8 Upgrade Series](/blog/2026-01-26-rails-upgrade-series-from-rails-4-to-8)
