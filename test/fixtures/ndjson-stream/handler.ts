import { createRouter } from 'rouzer'
import * as ndjson from 'rouzer/ndjson'
import { routes, type Event } from './routes.js'

async function* streamEvents(): AsyncIterable<Event> {
  yield { id: 1, message: 'ready' }
  yield { id: 2, message: 'done' }
}

export default createRouter({ plugins: [ndjson.routerPlugin] }).use(routes, {
  events() {
    return streamEvents()
  },
  fails() {
    return Response.json({ code: 'nope' }, { status: 418 })
  },
})
