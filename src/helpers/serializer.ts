import { Fuego } from '..'
import {
  CollectionQueryType,
  WhereArray,
  WhereItem,
  WhereType,
} from '../types/Query'

export class Serializer {
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

    console.log(where[2], where[2] instanceof fuego.DocumentReference)

    if (where[2] instanceof fuego.DocumentReference && !where[3]) {
      return [
        ...where.slice(0, 2),
        where[2].path,
        { type: 'ref' },
      ] as WhereItem<Doc>
    }

    return where
  }

  // Serializer function for query
  public static serializeQuery<Data extends object = {}>(
    query: CollectionQueryType<Data>,
    fuego: Fuego
  ): string {
    const { where, ...rest } = query

    return JSON.stringify({
      where: where ? this.serializeWhere(where, fuego) : undefined,
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

  // Deserializer function for query
  public static deserializeQuery<Data extends object = {}>(
    queryString: string,
    fuego: Fuego
  ): CollectionQueryType<Data> | undefined {
    const query: CollectionQueryType = JSON.parse(queryString)
    if (!query) return

    const { where, ...rest } = query

    return {
      where: where ? this.deserializeWhere(where, fuego) : undefined,
      ...rest,
    }
  }
}
