import { toFetchHandler } from 'rouzer'
import handler from './handler.js'

const baseURL = 'http://test.local'
const fetchHandler = toFetchHandler(handler)

function createLocalFetch(): typeof fetch {
  return (input, init) => fetchHandler(new Request(input, init))
}

async function assertInvalid(
  fetch: typeof globalThis.fetch,
  url: string,
  init: RequestInit | undefined,
  expectedMessage: string
) {
  const response = await fetch(url, init)
  expect(response.status).toBe(400)

  const body = await response.json()
  expect(body.message).toBe(expectedMessage)
}

export default {
  name: 'server validation rejects invalid inputs',
  async run() {
    const fetch = createLocalFetch()

    await assertInvalid(
      fetch,
      `${baseURL}/validate/x?q=ok`,
      { headers: { 'x-token': 'abc' } },
      'Invalid path parameter'
    )

    await assertInvalid(
      fetch,
      `${baseURL}/validate/ok?q=a`,
      { headers: { 'x-token': 'abc' } },
      'Invalid query string'
    )

    await assertInvalid(
      fetch,
      `${baseURL}/validate/ok?q=ok`,
      undefined,
      'Invalid request headers'
    )

    await assertInvalid(
      fetch,
      `${baseURL}/submit`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ count: -1 }),
      },
      'Invalid request body'
    )
  },
}
