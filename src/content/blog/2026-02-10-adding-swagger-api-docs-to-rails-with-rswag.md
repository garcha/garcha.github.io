---
title: "Adding Interactive API Documentation to Rails with Swagger and rswag"
description: "How we added OpenAPI 3.0 documentation to a Rails app using rswag, with admin-protected access and interactive testing for customers."
pubDate: 2026-02-10
tags: ["building-in-public", "engineering", "rails", "api"]
draft: false
generatedBy: "agent"
---

We recently added API documentation to our Rails application. The app has multiple API namespaces serving different use cases: a partner API, public endpoints, and internal endpoints.

The goal was straightforward: create documentation that our team could reference, but more importantly, that we could share with customers who integrate with our APIs. The twist? We often need to share individual endpoint documentation via email. A customer asks about one specific endpoint, and we want to send them exactly what they need—not the whole documentation. Swagger lets you copy a curl example for any endpoint, which is perfect for this workflow

This requirement led us to choose Swagger UI over ReDoc.

## Why Swagger UI Over ReDoc

Both Swagger UI and ReDoc render OpenAPI specifications beautifully. ReDoc arguably has a cleaner, more modern interface. But it's read-only.

Swagger UI has the "Try it out" feature. You click a button, fill in parameters, hit Execute, and see the actual API response. Customers can test authentication, verify response formats, and catch issues before writing any code. When I need to share endpoint details with external stakeholders, I can send them a curl example via email.

## Setting Up rswag

The rswag gem is a wrapper around Swagger UI that integrates with RSpec. You write your API specs as RSpec tests, and rswag generates OpenAPI YAML files from those specs. The approach feels natural in a Rails app already using RSpec.

We added three gems to our Gemfile:

```ruby
# API Documentation
gem "rswag-api"
gem "rswag-ui"

group :test, :development do
  gem "rswag-specs"
end
```

After running `bundle install`, we set up the configuration files.

### Configuring the Swagger endpoint

In `config/initializers/rswag_api.rb`, we pointed rswag at the directory where our OpenAPI YAML files live:

```ruby
Rswag::Api.configure do |c|
  c.openapi_root = Rails.root.join('swagger').to_s
end
```

In `config/initializers/rswag_ui.rb`, we configured the UI and added a critical security control:

```ruby
Rswag::Ui.configure do |c|
  c.openapi_endpoint '/admin/api-docs/v1/swagger.yaml', 'API V1'

  c.config_object[:supportedSubmitMethods] = []
end
```

## Defining the OpenAPI Spec

The `spec/swagger_helper.rb` file defines the global structure of our API documentation. This includes metadata, authentication schemes, reusable schemas, and tags.

```ruby
RSpec.configure do |config|
  config.openapi_root = Rails.root.join('swagger').to_s

  config.openapi_specs = {
    'v1/swagger.yaml' => {
      openapi: '3.0.1',
      info: {
        title: 'My API',
        version: 'v1',
        description: 'API documentation for the platform'
      },
      paths: {},
      servers: [
        {
          url: '{protocol}://{host}',
          variables: {
            protocol: {
              default: 'https',
              enum: ['http', 'https']
            },
            host: {
              default: 'www.example.com'
            }
          }
        }
      ],
      components: {
        securitySchemes: {
          api_key: {
            type: :apiKey,
            name: 'Authorization',
            in: :header,
            description: 'API key for endpoints'
          },
        },
        schemas: {
          Error: {
            type: :object,
            properties: {
              error: { type: :string },
              status: { type: :string }
            }
          },
          Person: {
            type: :object,
            properties: {
              id: { type: :integer },
              name: { type: :string },
            }
          }
        }
      }
    }
  }

  config.openapi_format = :yaml
end
```

## Writing Endpoint Specs

Each API endpoint gets documented in a spec file under `spec/requests/api/`. Here's an example:

```ruby
require 'swagger_helper'

RSpec.describe 'Api::V1::People', type: :request do
  path '/api/v1/people/{id}' do
    parameter name: :id, in: :path, type: :integer, description: 'Person ID'

    get 'Retrieve a person with hobbies' do
      tags 'People'
      description 'Returns person information and their hobbies'
      produces 'application/json'

      response '200', 'person found' do
        schema type: :object,
               properties: {
                 person: { '$ref' => '#/components/schemas/Person' },
                 hobbies: { type: :array, items: { type: :string } }
               }

        let(:person) { Fabricate(:person) }
        let(:id) { person.id }
        run_test!
      end

      response '404', 'person not found' do
        schema '$ref' => '#/components/schemas/Error'
        let(:id) { 0 }
        run_test!
      end
    end
  end
end
```

This does two things: it generates OpenAPI documentation, and it runs as a real integration test. The `run_test!` macro makes an actual HTTP request and validates the response against the schema.

After writing specs, we generate the YAML file:

```bash
rake rswag:specs:swaggerize
```

This creates `swagger/v1/swagger.yaml`, which Swagger UI reads.

## Security Considerations

We made a few decisions to balance usability with security:

1. **Admin-only access**: Documentation is mounted at `/admin/api-docs` behind admin authentication. Only internal team members can browse it by default.

2. **Disable "Try it out" in production**: The `supportedSubmitMethods: []` config disables interactive testing in production. This prevents unintended API calls from the docs interface.

3. **Authentication in specs**: By including authentication in the specs (e.g., `security [api_key: []]`), the documentation shows customers exactly how to authenticate. This reduces support questions.

## What I Learned

**Documentation as tests is a forcing function**: Writing specs that double as documentation forces you to think about edge cases. If you can't document a behavior clearly, it's probably not well-designed.

**Interactive docs reduce support burden**: Customers can test endpoints themselves before asking questions.

**Security defaults matter**: Disabling "Try it out" in production was a deliberate choice. We want customers to test in their own environments, not in production from our docs.

## Next Steps

We're still iterating on this setup. A few things on the roadmap:

- Add more examples to responses (rswag supports this with the `examples` key)
- Create a public subset of the docs for customers, separate from the admin view
- Automate YAML generation in CI so docs stay in sync with code

For now, rswag gives us a lightweight, Rails-native way to document APIs. The integration with RSpec means our docs are always tested, and the Swagger UI makes it easy for customers to get started quickly.
