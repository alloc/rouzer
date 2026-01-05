import type { TestFixture } from './fixtures/shared.js'

const fixtureModules = import.meta.glob<{ default: TestFixture }>(
  './fixtures/*/test.ts',
  { eager: true }
)

const fixtures = Object.entries(fixtureModules)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, module]) => module.default)

for (const fixture of fixtures) {
  test(fixture.name, fixture.run)
}
