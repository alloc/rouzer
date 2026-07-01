# Rouzer documentation

Rouzer combines a shared TypeScript route tree, a fetch-compatible server
router, a typed fetch client, and request context composition. These guides are
organized by concern so the docs directory is the complete entry point for what
you can do and how the pieces fit together.

## Learning Path

1. Read [Framework concepts](concepts.md) for the lifecycle and boundaries.
2. Read [Route contracts](routes.md) to declare resources, actions, schemas, and
   metadata.
3. Read [Middleware and request context](middleware.md) before writing shared
   context, auth, environment, tracing, or runtime-specific middleware.
4. Read [Routers and handlers](handlers.md) to attach route trees and implement
   handlers.
5. Read [Typed client](client.md) to call the same route tree from application
   code.
6. Read [Responses, errors, and plugins](responses.md) and
   [NDJSON streaming](streaming.md) when routes need more than a simple JSON
   success body.
7. Read [Runtime and adapters](runtime.md) when mounting Rouzer in a server or
   test harness.
8. Read [Patterns, constraints, and migrations](patterns.md) for conventions,
   gotchas, and upgrade notes.

## Guide Map

| Guide                                                | Concern                                                                                                                                             |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Framework concepts](concepts.md)                    | The high-level model, request lifecycle, and Rouzer's framework responsibilities.                                                                   |
| [Route contracts](routes.md)                         | `rouzer/http` resources, actions, Zod schemas, raw bodies, path patterns, and metadata.                                                             |
| [Middleware and request context](middleware.md)      | `chain`, request plugins, `RequestContext`, `context.host`, env access, `waitUntil`, `onResponse`, `passThrough`, isolation, and runtime filtering. |
| [Routers and handlers](handlers.md)                  | `createRouter`, route handler maps, validated handler context, CORS, debug mode, middleware ordering, and handler return values.                    |
| [Typed client](client.md)                            | `createClient`, generated action functions, flat input objects, headers, custom fetch, `onJsonError`, and lifecycle hooks.                          |
| [Responses, errors, and plugins](responses.md)       | `$type`, `$error`, response maps, status tuples, custom `Response` returns, and response plugin contracts.                                          |
| [NDJSON streaming](streaming.md)                     | Streaming response markers, router/client plugin registration, cancellation, and stream error modeling.                                             |
| [Runtime and adapters](runtime.md)                   | Root `toFetchHandler`, fetch-compatible mounting, custom host data, tests, CORS, and background work.                                               |
| [Patterns, constraints, and migrations](patterns.md) | Preferred project structure, common constraints, and migration notes from older Rouzer shapes.                                                      |

## Request Lifecycle

1. A shared route module exports resources and actions.
2. Server code creates a router, appends middleware, and attaches the route tree
   with a handler map.
3. Runtime code mounts the router with `toFetchHandler` or an adapter-specific
   helper.
4. Client code creates a generated client from the same route tree.
5. A client action validates route input, builds a `fetch` request, and sends
   it.
6. The router matches the request, validates path/query/body/header data, and
   calls the typed handler.
7. The handler returns JSON data, a custom `Response`, a declared response-map
   helper, or a response-plugin value such as an NDJSON source.
8. Response callbacks registered by middleware can finalize headers or replace
   the response before it leaves the chain.

## Framework Surface

Rouzer owns:

- route tree declarations and handler/client type inference
- request validation from route schemas
- route matching and handler dispatch
- response markers, response maps, and response plugin integration
- generated client action functions

Rouzer middleware and runtime helpers cover:

- middleware chaining and short-circuit behavior
- request context creation and extension
- host data such as `context.host.ip` and `context.host.runtime`
- typed environment access through `context.env(...)`
- `waitUntil`, `setHeader`, `onResponse`, `passThrough`, and chain isolation
- adapter helpers such as `toFetchHandler`
