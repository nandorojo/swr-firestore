import {
  FieldPath,
  OrderByDirection,
  WhereFilterOp,
} from '@firebase/firestore-types'
import { SerializerOptions } from './Serializer'

type KeyHack = string & {} // hack to also allow strings

// here we get the "key" from our data, to add intellisense for any "orderBy" in the queries and such.
export type OrderByArray<Doc extends object = {}, Key = keyof Doc> = [
  Key | FieldPath | KeyHack,
  OrderByDirection
]
export type OrderByItem<Doc extends object = {}, Key = keyof Doc> =
  | OrderByArray<Doc>
  | Key
  | KeyHack
export type OrderByType<Doc extends object = {}> =
  | OrderByItem<Doc>
  | OrderByArray<Doc>[]

export type WhereItem<Doc extends object = {}, Key = keyof Doc> = [
  Key | FieldPath | KeyHack,
  WhereFilterOp,
  unknown,
  SerializerOptions?
]
export type WhereArray<Doc extends object = {}> = WhereItem<Doc>[]
export type WhereType<Doc extends object = {}> =
  | WhereItem<Doc>
  | WhereArray<Doc>

export type CollectionQueryType<Doc extends object = {}> = {
  limit?: number
  orderBy?: OrderByType<Doc>
  where?: WhereType<Doc>
  isCollectionGroup?: boolean

  /**
   * For now, this can only be a number, since it has to be JSON serializable.
   *
   * **TODO** allow DocumentSnapshot here too. This will probably be used with a useStaticCollection hook in the future.
   */
  startAt?: number
  /**
   * For now, this can only be a number, since it has to be JSON serializable.
   *
   * **TODO** allow DocumentSnapshot here too. This will probably be used with a useStaticCollection hook in the future.
   */
  endAt?: number
  /**
   * For now, this can only be a number, since it has to be JSON serializable.
   *
   * **TODO** allow DocumentSnapshot here too. This will probably be used with a useStaticCollection hook in the future.
   */
  startAfter?: number
  /**
   * For now, this can only be a number, since it has to be JSON serializable.
   *
   * **TODO** allow DocumentSnapshot here too. This will probably be used with a useStaticCollection hook in the future.
   */
  endBefore?: number

  // THESE ARE NOT JSON SERIALIZABLE
  // startAt?: number | DocumentSnapshot
  // endAt?: number | DocumentSnapshot
  // startAfter?: number | DocumentSnapshot
  // endBefore?: number | DocumentSnapshot
}
