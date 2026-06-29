# Testing And Compatibility

## Current test dependency on Hattip

`rouzer` currently relies on `@hattip/adapter-test` to turn a Hattip handler into
a `fetch` function. `alien-middleware` tests construct `AdapterRequestContext`
objects directly.

These should be replaced with package-owned test helpers before or during the
Nitro migration.

## Shared test helpers

Add a small test utility in `alien-middleware`:

```ts
export function createTestContext(
  request = new Request('http://localhost/')
): RequestContext {
  return createContext({
    request,
    host: {
      env: () => undefined,
      platform: {},
      passThrough: () => {},
      waitUntil: () => {},
    },
  })
}
```

Add a second helper for packages that only need `fetch`:

```ts
export function createTestFetch(handler: RequestHandler): typeof fetch {
  return (requestInfo, init) => {
    const request =
      requestInfo instanceof Request
        ? init
          ? new Request(requestInfo, init)
          : requestInfo
        : new Request(requestInfo, init)
    return handler(createTestContext(request))
  }
}
```

Rouzer can either import a published test helper from `alien-middleware` or keep
an equivalent local fixture.

## Behavioral tests to preserve

Keep or add coverage for:

- Immutable `.use()` chains.
- `use(null)` no-op behavior.
- Request plugins extending downstream context properties.
- `env` request plugins overriding the parent environment accessor.
- Response callbacks running after default `404` responses.
- Response callbacks being able to replace responses.
- Immutable or non-default `Response` objects being cloned before header edits.
- Middleware deduplication.
- Isolated chain behavior.
- `passThrough()` skipping the rest of the current chain.
- `waitUntil()` being available from middleware and response callbacks.
- `filterPlatform()` behavior against the new host/platform field.
- Rouzer route matching, validation, response plugins, response maps, CORS, and
  NDJSON streaming.

## Nitro adapter tests

The adapter should have a small dedicated test suite instead of relying on a
full Nitro dev server for every unit test.

Cover:

- A Nitro event with a `Request` reaches the underlying chain.
- A middleware response terminates the handler.
- `undefined` from a server-entry-style middleware continues when appropriate.
- `event.waitUntil` is called when middleware calls `context.waitUntil`.
- Selected Nitro event context data is exposed through `context.host.platform`
  or another documented host extension.

Add one integration test, if feasible, that builds a tiny Nitro app with the
adapter and performs real `fetch` calls against it. This can live behind the
normal test command only if it is fast and deterministic.

## Type tests

Type inference is the value proposition of both packages. Add or update compile
tests for:

- `RequestContext<Env, Properties, Platform>` after the context rename.
- Middleware plugins preserving downstream properties.
- Rouzer handler context inference from path, query, headers, body, response
  helpers, and middleware.
- Deprecated aliases, if any are kept for a transition release.
- `rouzer/nitro` and/or `alien-middleware/nitro` exported helper types.

## Compatibility strategy

This migration is a breaking change if Hattip imports disappear from public
types. Use a major release or a two-step transition:

1. Add neutral context and handler types while keeping deprecated Hattip aliases.
2. Move docs and examples to Nitro.
3. Remove Hattip aliases in the next major version.

If the goal is a clean migration rather than a compatibility bridge, make the
breaking change directly and publish major versions for both packages.

## Release-order constraint

Publish or link the migrated `alien-middleware` first. Then migrate `rouzer` to
depend on that version. Rouzer's source imports `MiddlewareChain`,
`RequestContext`, and `MiddlewareTypes`, so it should not carry an independent
context fork.
