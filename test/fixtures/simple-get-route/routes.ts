import { $type, route } from 'rouzer'

export const helloRoute = route('hello/:name', {
  GET: {
    response: $type<{ message: string }>(),
  },
})
