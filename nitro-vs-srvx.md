# Nitro vs srvx

This comparison is scoped to replacing Hattip as the HTTP foundation for
`rouzer` and `../alien-middleware`.

## Summary

Use srvx as the replacement HTTP substrate. It is closer to the current Hattip
contract, requires less redesign, and lets both packages stay centered on Web
`Request`/`Response` handlers.

Use Nitro when building an application that wants Nitro's broader app runtime:
file-system routing, build output, deployment presets, runtime config, hooks,
storage, cache, database, and renderer integration.

## API fit

srvx:

- Primary contract is `fetch(request: Request): Response | Promise<Response>`.
- Extended request data includes `ip`, `waitUntil`, and `runtime`.
- Programmatic server startup is `serve({ fetch })`.
- Middleware exists, but the fetch handler is enough for Rouzer.

Nitro:

- Primary app integration can be a Web `fetch(request)` server entry.
- Native route integration uses `defineHandler(event)` and H3 event semantics.
- Provides request/response hooks, route rules, filesystem routing, and build
  output.
- Adds a larger framework surface than these libraries need for their core
  server handler.

Result: srvx is the more direct replacement for Hattip's adapter role. Nitro is
more of an app framework/runtime shell.

## Migration impact

srvx:

- Replace Hattip public context types with package-owned Web context types.
- Add `toFetchHandler`.
- Map srvx `ServerRequest` metadata into `context.host`.
- Replace Hattip test fixtures with fetch-based fixtures.
- Leave Rouzer route matching and validation intact.

Nitro:

- Requires the same Hattip public type removal.
- Adds a decision between Web server entry and Nitro `defineHandler(event)`.
- Requires more careful lifecycle mapping for `undefined`, hooks, and event
  context.
- Has useful app-level features, but they are mostly outside Rouzer's core API.

Result: both require removing Hattip types, but srvx has fewer framework
semantics to reconcile.

## Runtime and deployment

srvx:

- Runs on Node.js, Bun, and Deno.
- Has explicit runtime imports for bundlers.
- Provides Node compatibility, static middleware, CLI, and AWS Lambda helpers.
- Does not produce a full deployment artifact by itself.

Nitro:

- Produces `.output` builds for many deployment targets.
- Supports zero-config provider detection and route rules.
- Includes runtime config, plugins, hooks, storage, caching, and database APIs.
- Current docs describe Nitro v3 beta, and `nitro` currently resolves to
  `3.0.260610-beta`.

Result: Nitro wins for full application packaging and deployment. srvx wins for
minimal server abstraction.

## Type surface

srvx:

- Can be kept behind `alien-middleware/srvx`.
- Root exports can remain Web-standard and avoid forcing srvx types on all
  users.
- `ServerRequest` is a small extension of `Request`.

Nitro:

- Nitro helpers likely need H3/Nitro event types.
- More framework-specific event data must be modeled or hidden.
- Root exports should avoid depending directly on Nitro unless the packages
  intentionally become Nitro-first.

Result: srvx is easier to isolate as an adapter while keeping the core portable.

## Recommendation

Migrate `alien-middleware` and `rouzer` to a package-owned Web request context
and use srvx as the first-class HTTP server adapter.

Implement:

1. `alien-middleware` root types that no longer mention Hattip.
2. A root or `alien-middleware/srvx` `toFetchHandler` helper.
3. Optional `rouzer/srvx` convenience wrapper only if it meaningfully improves
   docs.
4. Fetch-based tests replacing `@hattip/adapter-test`.

Keep Nitro as an app-level integration target, not the core replacement. Once
the fetch adapter exists, Nitro users can still mount Rouzer through Nitro's
Web-compatible `server.ts` entry. Add a Nitro-specific adapter only if consumers
need direct `defineHandler(event)` access to Nitro lifecycle data.
