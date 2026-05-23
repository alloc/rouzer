import { $type, $error } from 'rouzer'
import * as http from 'rouzer/http'
import * as ndjson from 'rouzer/ndjson'

export type User = {
  id: string
  name: string
}

export type NotFoundError = {
  code: 'NOT_FOUND'
  message: string
}

export type AuthError = {
  code: 'UNAUTHORIZED'
  message: string
}

export const getUser = http.get('users/:id', {
  response: {
    200: $type<User>(),
    401: $error<AuthError>(),
    404: $error<NotFoundError>(),
  },
})

export const streamUsers = http.get('users.ndjson', {
  response: {
    200: ndjson.$type<User>(),
    404: $error<NotFoundError>(),
  },
})
