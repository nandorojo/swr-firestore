import useSWR, { mutate as mutateStatic, ConfigInterface } from 'swr'
import { fuego } from '../context'
import { useRef, useEffect, useMemo, useCallback } from 'react'
// import { useMemoOne as useMemo } from 'use-memo-one'
import { empty } from '../helpers/empty'

type Document<T = {}> = T & { id: string }

import {
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
        const [order, direction] = orderBy
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

type ListenerReturnType<Doc extends Document = Document> = {
  initialData: Doc[] | null
  unsubscribe: ReturnType<ReturnType<typeof fuego['db']['doc']>['onSnapshot']>
}

const createListenerAsync = async <Doc extends Document = Document>(
  path: string,
  queryString: string
): Promise<ListenerReturnType<Doc>> => {
  return new Promise(resolve => {
    const query: Ref = JSON.parse(queryString) ?? {}
    const ref = createRef(path, query)
    const unsubscribe = ref.onSnapshot(querySnapshot => {
      const data: Doc[] = []
      querySnapshot.forEach(doc => {
        const docData = doc.data() ?? empty.object
        const docToAdd = {
          ...docData,
          id: doc.id,
          exists: doc.exists,
          hasPendingWrites: doc.metadata.hasPendingWrites,
        } as any
        if (
          __DEV__ &&
          // @ts-ignore
          (docData.exists || docData.id || docData.hasPendingWrites)
        ) {
          console.warn(
            '[use-document] warning: Your document, ',
            doc.id,
            ' is using one of the following reserved fields: [exists, id, hasPendingWrites]. These fields are reserved. Please remove them from your documents.'
          )
        }
        // update individual docs in the cache
        mutateStatic(`${path}/${doc.id}`, docToAdd, false)
        data.push(docToAdd)
      })
      // resolve initial data
      resolve({
        initialData: data,
        unsubscribe,
      })
      // update on listener fire
      mutateStatic([path, queryString], data, false)
    })
  })
}

type Options<Doc extends Document = Document> = {
  listen?: boolean
} & ConfigInterface<Doc[] | null>
/**
 * Call a Firestore Collection
 * @template Doc
 * @param path String if the document is ready. If it's not ready yet, pass `null`, and the request won't start yet.
 * @param [query] - Dictionary with options to query the collection.
 * @param [options] - Dictionary with option `listen`. If true, it will open a socket listener. Also takes any of SWR's options.
 */
export const useCollection = <
  Data extends object = {},
  Doc extends Document = Document<Data>
>(
  path: string | null,
  query: Ref = empty.object,
  options: Options<Doc> = empty.object
) => {
  const unsubscribeRef = useRef<ListenerReturnType['unsubscribe'] | null>(null)
  const { listen = false, ...swrOptions } = options

  const { where, endAt, endBefore, startAfter, startAt, orderBy, limit } = query

  // why not just put this into the ref directly?
  // so that we can use the useEffect down below that triggers revalidate()
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

  // we move listen to a Ref
  // why? because we shouldn't have to include "listen" in the key
  // if we do, then calling mutate() won't be consistent for all
  // collections with the same path & query
  const shouldListen = useRef(listen)
  useEffect(() => {
    shouldListen.current = listen
  })

  const swr = useSWR<Doc[] | null>(
    // if the path is null, this means we don't want to fetch yet.
    [path, memoQueryString],
    async (path: string, queryString: string) => {
      if (shouldListen.current) {
        if (unsubscribeRef.current) {
          unsubscribeRef.current()
          unsubscribeRef.current = null
        }
        const { unsubscribe, initialData } = await createListenerAsync<Doc>(
          path,
          queryString
        )
        unsubscribeRef.current = unsubscribe
        return initialData
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
          // update individual docs in the cache
          mutateStatic(`${path}/${doc.id}`, docToAdd, false)
          if (
            __DEV__ &&
            // @ts-ignore
            (docData.exists || docData.id || docData.hasPendingWrites)
          ) {
            console.warn(
              '[use-document] warning: Your document, ',
              doc.id,
              ' is using one of the following reserved fields: [exists, id, hasPendingWrites]. These fields are reserved. Please remove them from your documents.'
            )
          }
          array.push(docToAdd)
        })
        return array
      })
      return data
    },
    swrOptions
  )

  // if listen or changes,
  // we run revalidate.
  // This triggers SWR to fetch again
  // Why? because we don't want to put listen
  // in the useSWR key. If we did, then we couldn't mutate
  // based on query alone. If we had useSWR(['users', true]),
  // but then a `users` fetch with `listen` set to `false` updated, it wouldn't mutate both.
  // thus, we move the `listen` and option to a ref user in `useSWR`,
  // and we call `revalidate` if it changes.
  useEffect(() => {
    if (revalidateRef.current) revalidateRef.current()
  }, [listen])

  // this MUST be after the previous effect to avoid duplicate initial validations.
  // only happens on updates, not initial mounting
  const revalidateRef = useRef(swr.revalidate)
  useEffect(() => {
    revalidateRef.current = swr.revalidate
  })

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

  const add = useCallback(
    (data: Doc | Doc[]) => {
      if (!listen) {
        // we only update the local cache if we don't have a listener set up
        mutate(prevState => {
          const state = prevState ?? empty.array
          const addedState = Array.isArray(data) ? data : [data]
          return [...state, ...addedState]
        })
      }
      if (!path) return null
      return fuego.db.collection(path).add(data)
    },
    [listen, mutate, path]
  )

  return {
    data,
    isValidating,
    revalidate,
    mutate,
    error,
    add,
    loading: !data && !error,
  }
}
