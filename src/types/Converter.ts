import { firestore } from 'firebase'

export type Converter<
  Doc extends object = {}
> = firestore.FirestoreDataConverter<Omit<Doc, 'exists' | 'hasPendingWrites'>>
