import { $type, route } from 'rouzer'

export const jsonRoute = route('json', {
  GET: {
    response: $type<{ message: string }>(),
  },
})

export const pingRoute = route('ping', {
  GET: {},
})
