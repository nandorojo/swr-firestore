import { QueryDocumentSnapshot } from '@firebase/firestore-types'

export type Document<T = {}> = T & {
  id: string
  exists?: boolean
  hasPendingWrites?: boolean
  __snapshot?: QueryDocumentSnapshot
}
