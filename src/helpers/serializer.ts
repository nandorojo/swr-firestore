import { DocumentSnapshot } from '@firebase/firestore-types'
import { SerializerOptions } from 'src/types/Serializer'
import { Fuego } from '../classes/Fuego'
import {
  CollectionQueryType,
  SerializedCollectionQueryType,
  WhereArray,
  WhereItem,
  WhereType,
} from '../types/Query'

export class Serializer {
  private static snapshotCache: Record<string, DocumentSnapshot> = {}

  private static isSnapshot(value: unknown, fuego: Fuego) {
    if (!value) return false
    return (
      fuego.firestore?.DocumentSnapshot &&
      value instanceof fuego.firestore.DocumentSnapshot
    )
  }

  // Helper for where clauses
  public static multipleConditions<Doc extends object = {}>(
    w: WhereType<Doc>
  ): w is WhereArray<Doc> {
    return !!(w as WhereArray) && Array.isArray(w[0])
  }

  // Serializer function for where condition
  private static serializeWhere<Doc extends object = {}>(
    where: WhereType<Doc>,
    fuego: Fuego
  ): WhereType<Doc> {
    if (this.multipleConditions(where)) {
      return where.map(w => this.serializeWhere(w, fuego)) as WhereArray<Doc>
    }
    // Date: Inject serializer options if not specified
    if (where[2] instanceof Date && !where[3]) {
      return [...where.slice(0, 3), { type: 'date' }] as WhereItem<Doc>
    }

    if (
      fuego.firestore?.DocumentReference &&
      where[2] instanceof fuego.firestore.DocumentReference &&
      !where[3]
    ) {
      return [
        ...where.slice(0, 2),
        where[2].path,
        { type: 'ref' },
      ] as WhereItem<Doc>
    }

    return where
  }

  // Serializer funciton for DocumentSnapshot
  private static serializeSnapshot(
    snapshot: DocumentSnapshot
  ): SerializerOptions {
    this.snapshotCache[snapshot.ref.path] = snapshot

    return {
      type: 'snapshot',
      path: snapshot.ref.path,
    }
  }

  private static serializeNumberOrSnapshot(
    value?: number | DocumentSnapshot
  ): SerializerOptions | number | undefined {
    if (!value) return undefined
    if (typeof value === 'number') return value

    return this.serializeSnapshot(value)
  }

  // Serializer function for query
  public static serializeQuery<Data extends object = {}>(
    query: CollectionQueryType<Data>,
    fuego: Fuego
  ): string {
    const { where, startAt, endAt, startAfter, endBefore, ...rest } = query

    return JSON.stringify({
      where: where ? this.serializeWhere(where, fuego) : undefined,
      startAt: this.serializeNumberOrSnapshot(startAt),
      endAt: this.serializeNumberOrSnapshot(endAt),
      startAfter: this.serializeNumberOrSnapshot(startAfter),
      endBefore: this.serializeNumberOrSnapshot(endBefore),
      ...rest,
    })
  }

  // Deserializer function for where condition
  private static deserializeWhere<Doc extends object = {}>(
    where: WhereType<Doc>,
    fuego: Fuego
  ): WhereType<Doc> {
    if (this.multipleConditions(where)) {
      return where.map(w => this.deserializeWhere(w, fuego)) as WhereArray<Doc>
    }

    if (where[3]?.type === 'date' && typeof where[2] === 'string') {
      return [...where.slice(0, 2), new Date(where[2]), where[3]] as WhereItem<
        Doc
      >
    }

    if (where[3]?.type === 'ref' && typeof where[2] === 'string') {
      return [
        ...where.slice(0, 2),
        fuego.db.doc(where[2]),
        where[3],
      ] as WhereItem<Doc>
    }

    return where
  }

  // Deserializer function for document snapshots
  private static deserializeSnapshot(
    snapshot: SerializerOptions
  ): DocumentSnapshot | undefined {
    if (snapshot.type !== 'snapshot') return

    return this.snapshotCache[snapshot.path]
  }

  private static deserializeNumberOrSnapshot(
    value?: number | SerializerOptions
  ): DocumentSnapshot | number | undefined {
    if (!value) return undefined
    if (typeof value === 'number') return value

    return this.deserializeSnapshot(value)
  }

  // Deserializer function for query
  public static deserializeQuery<Data extends object = {}>(
    queryString: string,
    fuego: Fuego
  ): CollectionQueryType<Data> | undefined {
    const query: SerializedCollectionQueryType<Data> = JSON.parse(queryString)
    if (!query) return

    const { where, startAt, endAt, startAfter, endBefore, ...rest } = query

    return {
      where: where ? this.deserializeWhere(where, fuego) : undefined,
      startAt: this.deserializeNumberOrSnapshot(startAt),
      endAt: this.deserializeNumberOrSnapshot(endAt),
      startAfter: this.deserializeNumberOrSnapshot(startAfter),
      endBefore: this.deserializeNumberOrSnapshot(endBefore),
      ...rest,
    }
  }

  public static cleanQuery<Data extends object = {}>(
    query: CollectionQueryType<Data>,
    fuego: Fuego
  ) {
    const { startAt, endAt, startAfter, endBefore } = query

    if (this.isSnapshot(startAt, fuego)) {
      delete this.snapshotCache[(startAt as DocumentSnapshot).ref.path]
    }
    if (this.isSnapshot(endAt, fuego)) {
      delete this.snapshotCache[(endAt as DocumentSnapshot).ref.path]
    }
    if (this.isSnapshot(startAfter, fuego)) {
      delete this.snapshotCache[(startAfter as DocumentSnapshot).ref.path]
    }
    if (this.isSnapshot(endBefore, fuego)) {
      delete this.snapshotCache[(endBefore as DocumentSnapshot).ref.path]
    }
  }
}
