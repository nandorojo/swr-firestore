import { QueryDocumentSnapshot } from '@firebase/firestore-types'

export type Document<T = {}> = T & {
  id: string
  exists?: boolean
  hasPendingWrites?: boolean
  __snapshot?: QueryDocumentSnapshot
}
export type AllowType<O extends object, Allowed> = {
  [K in keyof O]: O[K] | Allowed
}
