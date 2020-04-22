export type Document<T = {}> = T & {
  id: string
  exists?: boolean
  hasPendingWrites?: boolean
}
