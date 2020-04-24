import useSWR, { mutate, ConfigInterface } from 'swr'
import { fuego } from '../context'
import { useRef, useEffect, useMemo } from 'react'
// import { useMemoOne as useMemo } from 'use-memo-one'
import { empty } from '../helpers/empty'

type Document = { id: string }

import {
  DocumentSnapshot,
  FieldPath,
  OrderByDirection,
  WhereFilterOp,
  Query,
} from '@firebase/firestore-types'

type OrderByArray = [string | FieldPath, OrderByDirection]
type OrderByItem = OrderByArray | string
type OrderByType = OrderByItem | OrderByArray[]

type WhereItem = [string | FieldPath, WhereFilterOp, unknown]
type WhereArray = WhereItem[]
type WhereType = WhereItem | WhereArray

type Ref = {
  limit?: number
  orderBy?: OrderByType
  where?: WhereType

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

type Path = string
type Listen = boolean

type SwrKey = [Path, Listen, string]

const createRef = (
  path: string,
  { where, orderBy, limit, startAt, endAt, startAfter, endBefore }: Ref
) => {
  let ref: Query = fuego.db.collection(path)

  if (where) {
    function multipleConditions(w: WhereType): w is WhereArray {
      return !!(w as WhereArray) && Array.isArray(w[0])
    }
    if (multipleConditions(where)) {
      where.forEach(w => {
        ref = ref.where(w[0], w[1], w[2])
      })
    } else if (typeof where[0] === 'string' && typeof where[1] === 'string') {
      ref = ref.where(where[0], where[1], where[2])
    }
  }
  if (orderBy) {
    if (typeof orderBy === 'string') {
      ref = ref.orderBy(orderBy)
    } else if (Array.isArray(orderBy)) {
      function multipleOrderBy(o: OrderByType): o is OrderByArray[] {
        return Array.isArray((o as OrderByArray[])[0])
      }
      if (multipleOrderBy(orderBy)) {
        orderBy.forEach(order => {
          ref = ref.orderBy(...order)
        })
      } else {
        const [order, direction] = orderBy as OrderByArray
        ref = ref.orderBy(order, direction)
      }
    }
  }
  if (startAt) {
    ref = ref.startAt(startAt)
  }
  if (endAt) {
    ref = ref.endAt(endAt)
  }
  if (startAfter) {
    ref = ref.startAfter(startAfter)
  }
  if (endBefore) {
    ref = ref.endBefore(endBefore)
  }
  if (limit) {
    ref = ref.limit(limit)
  }
  return ref
}

const createListener = <Doc extends Document = Document>(
  path: string,
  queryString: string
) => {
  const query: Ref = JSON.parse(queryString) ?? {}
  let data: Doc[] | null = null
  const ref = createRef(path, query)

  const unsubscribe = ref.onSnapshot(querySnapshot => {
    const array: typeof data = []
    querySnapshot.forEach(doc => {
      const docData = doc.data() ?? empty.object
      const docToAdd = {
        ...docData,
        id: doc.id,
        exists: doc.exists,
        hasPendingWrites: doc.metadata.hasPendingWrites,
      } as any
      array.push(docToAdd)
    })
    data = array
    mutate([path, true, queryString], data, false)
  })

  return {
    latestData: () => data,
    unsubscribe,
  }
}

type Options<Doc extends Document = Document> = {
  listen?: boolean
} & ConfigInterface<Doc[] | null>
/**
 * Call a Firestore Collection
 * @template Doc
 * @param path String if the document is ready. If it's not ready yet, pass `null`, and the request won't start yet.
 * @param [query] - Dictionary with options to query the collection.
 * @param [options] - Dictionary with option `listen`. If true, it will open a socket listener.
 * @returns
 */
export const useCollection = <Doc extends Document = Document>(
  path: string | null,
  query: Ref = empty.object,
  options: Options<Doc> = empty.object
) => {
  const unsubscribeRef = useRef<
    ReturnType<typeof createListener>['unsubscribe'] | null
  >(null)
  const { listen = false, ...swrOptions } = options

  const { where, endAt, endBefore, startAfter, startAt, orderBy, limit } = query

  const memoQueryString = useMemo(
    () =>
      JSON.stringify({
        where,
        endAt,
        endBefore,
        startAfter,
        startAt,
        orderBy,
        limit,
      }),
    [endAt, endBefore, limit, orderBy, startAfter, startAt, where]
  )

  const swr = useSWR<Doc[] | null>(
    // if the path is null, this means we don't want to fetch yet.
    path === null ? null : [path, listen, memoQueryString],
    async (...[path, listen, queryString]: SwrKey) => {
      if (listen) {
        if (unsubscribeRef.current) {
          unsubscribeRef.current()
        }
        const { unsubscribe, latestData } = createListener<Doc>(
          path,
          queryString
        )
        unsubscribeRef.current = unsubscribe
        return latestData()
      }

      const query: Ref = JSON.parse(queryString) ?? {}
      const ref = createRef(path, query)
      const data: Doc[] = await ref.get().then(querySnapshot => {
        const array: typeof data = []
        querySnapshot.forEach(doc => {
          const docData = doc.data() ?? empty.object
          const docToAdd = {
            ...docData,
            id: doc.id,
            exists: doc.exists,
            hasPendingWrites: doc.metadata.hasPendingWrites,
          } as any
          array.push(docToAdd)
        })
        return array
      })
      return data
    },
    swrOptions
  )

  useEffect(() => {
    return () => {
      // clean up listener on unmount if it exists
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
        unsubscribeRef.current = null
      }
    }
    // should depend on the path, queyr, and listen being the same...
  }, [path, listen, memoQueryString])

  const { data, isValidating, revalidate, mutate, error } = swr

  return { data, isValidating, revalidate, mutate, error }
}
