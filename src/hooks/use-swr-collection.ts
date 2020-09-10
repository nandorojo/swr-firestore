import useSWR, { mutate as mutateStatic, ConfigInterface } from 'swr'
import { fuego } from '../context'
import { useRef, useEffect, useMemo, useCallback } from 'react'
// import { useMemoOne as useMemo } from 'use-memo-one'
import { empty } from '../helpers/empty'
import { collectionCache } from '../classes/Cache'

type Document<T = {}> = T & { id: string }

import {
  FieldPath,
  OrderByDirection,
  WhereFilterOp,
  Query,
  FirestoreDataConverter,
} from '@firebase/firestore-types'
import { isDev } from '../helpers/is-dev'
import { withDocumentDatesParsed } from '../helpers/doc-date-parser'

// here we get the "key" from our data, to add intellisense for any "orderBy" in the queries and such.
type OrderByArray<Doc extends object = {}, Key = keyof Doc> = [
  Key | FieldPath,
  OrderByDirection
]
type OrderByItem<Doc extends object = {}, Key = keyof Doc> =
  | OrderByArray<Doc>
  | Key
type OrderByType<Doc extends object = {}> =
  | OrderByItem<Doc>
  | OrderByArray<Doc>[]

type WhereItem<Doc extends object = {}, Key = keyof Doc> = [
  Key | FieldPath,
  WhereFilterOp,
  unknown
]
type WhereArray<Doc extends object = {}> = WhereItem<Doc>[]
type WhereType<Doc extends object = {}> = WhereItem<Doc> | WhereArray<Doc>

type ConverterType<Doc extends object = {}> = FirestoreDataConverter<Doc>

type Ref<Doc extends object = {}> = {
  limit?: number
  orderBy?: OrderByType<Doc>
  where?: WhereType<Doc>

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

const createRef = <Doc extends object = {}>(
  path: string,
  { where, orderBy, limit, startAt, endAt, startAfter, endBefore }: Ref<Doc>,
  {
    isCollectionGroup = false,
    documentDataConverter,
  }: {
    isCollectionGroup?: boolean
    documentDataConverter?: ConverterType<Doc>
  } = empty.object
) => {
  let ref: Query = fuego.db.collection(path)

  if (isCollectionGroup) {
    ref = fuego.db.collectionGroup(path)
  }

  if (where) {
    function multipleConditions(w: WhereType<Doc>): w is WhereArray<Doc> {
      return !!(w as WhereArray) && Array.isArray(w[0])
    }
    if (multipleConditions(where)) {
      where.forEach(w => {
        ref = ref.where(w[0] as string | FieldPath, w[1], w[2])
      })
    } else if (typeof where[0] === 'string' && typeof where[1] === 'string') {
      ref = ref.where(where[0], where[1], where[2])
    }
  }
  if (orderBy) {
    if (typeof orderBy === 'string') {
      ref = ref.orderBy(orderBy)
    } else if (Array.isArray(orderBy)) {
      function multipleOrderBy(o: OrderByType<Doc>): o is OrderByArray<Doc>[] {
        return Array.isArray((o as OrderByArray<Doc>[])[0])
      }
      if (multipleOrderBy(orderBy)) {
        orderBy.forEach(([order, direction]) => {
          ref = ref.orderBy(order as string | FieldPath, direction)
        })
      } else {
        const [order, direction] = orderBy
        ref = ref.orderBy(order as string | FieldPath, direction)
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
  if (documentDataConverter) {
    ref = ref.withConverter(documentDataConverter)
  }
  return ref
}

type ListenerReturnType<Doc extends Document = Document> = {
  initialData: Doc[] | null
  unsubscribe: ReturnType<ReturnType<typeof fuego['db']['doc']>['onSnapshot']>
}

const createListenerAsync = async <Doc extends Document = Document>(
  path: string,
  queryString: string,
  {
    parseDates,
    documentDataConverter,
    isCollectionGroup = false,
  }: {
    parseDates?: (string | keyof Doc)[]
    documentDataConverter?: ConverterType<Doc>
    isCollectionGroup?: boolean
  }
): Promise<ListenerReturnType<Doc>> => {
  return new Promise(resolve => {
    const query: Ref = JSON.parse(queryString) ?? {}
    const ref = createRef(path, query, {
      documentDataConverter,
      isCollectionGroup,
    })
    const unsubscribe = ref.onSnapshot(
      { includeMetadataChanges: true },
      querySnapshot => {
        const data: Doc[] = []
        querySnapshot.forEach(doc => {
          const docData =
            doc.data({
              serverTimestamps: 'estimate',
            }) ?? empty.object
          const docToAdd = withDocumentDatesParsed(
            {
              ...docData,
              id: doc.id,
              exists: doc.exists,
              hasPendingWrites: doc.metadata.hasPendingWrites,
            } as any,
            parseDates
          )
          if (
            isDev &&
            // @ts-ignore
            (docData.exists || docData.id || docData.hasPendingWrites)
          ) {
            console.warn(
              '[use-collection] warning: Your document, ',
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
      }
    )
  })
}

type Options<Doc extends Document = Document> = ConfigInterface<Doc[] | null>
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
  query: Ref<Data> & {
    /**
     * If `true`, sets up a real-time subscription to the Firestore backend.
     *
     * Default: `false`
     */
    listen?: boolean
    documentDataConverter?: ConverterType<Doc>
    /**
     * An array of key strings that indicate where there will be dates in the document.
     *
     * Example: if your dates are in the `lastUpdated` and `user.createdAt` fields, then pass `{parseDates: ["lastUpdated", "user.createdAt"]}`.
     *
     * This will automatically turn all Firestore dates into JS Date objects, removing the need to do `.toDate()` on your dates.
     */
    parseDates?: (string | keyof Doc)[]
    /**
     * Use the `useCollectionGroup` hook instead of this.
     */
    __unstableCollectionGroup?: boolean
  } = empty.object,
  options: Options<Doc> = empty.object
) => {
  const unsubscribeRef = useRef<ListenerReturnType['unsubscribe'] | null>(null)

  const {
    where,
    endAt,
    endBefore,
    startAfter,
    startAt,
    orderBy,
    limit,
    listen = false,
    documentDataConverter,
    parseDates,
    __unstableCollectionGroup: isCollectionGroup = false,
  } = query

  // if we're listening, the firestore listener handles all revalidation
  const {
    refreshInterval = listen ? 0 : undefined,
    refreshWhenHidden = listen ? false : undefined,
    refreshWhenOffline = listen ? false : undefined,
    revalidateOnFocus = listen ? false : undefined,
    revalidateOnReconnect = listen ? false : undefined,
  } = options

  const swrOptions = {
    ...options,
    refreshInterval,
    refreshWhenHidden,
    refreshWhenOffline,
    revalidateOnFocus,
    revalidateOnReconnect,
  }

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

  // we move this to a Ref
  // why? because we shouldn't have to include it in the key
  // if we do, then calling mutate() won't be consistent for all
  // collections with the same path & query
  // TODO figure out if this is the right behavior...probably not because of the paths. hm.
  const isCollectionGroupQuery = useRef(isCollectionGroup)
  useEffect(() => {
    isCollectionGroupQuery.current = isCollectionGroup
  }, [isCollectionGroup])

  const dateParser = useRef(parseDates)
  useEffect(() => {
    dateParser.current = parseDates
  }, [parseDates])

  const documentConverter = useRef(documentDataConverter)
  useEffect(() => {
    documentConverter.current = documentDataConverter
  }, [documentDataConverter])

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
    path === null ? null : [path, memoQueryString],
    async (path: string, queryString: string) => {
      if (shouldListen.current) {
        if (unsubscribeRef.current) {
          unsubscribeRef.current()
          unsubscribeRef.current = null
        }
        const { unsubscribe, initialData } = await createListenerAsync<Doc>(
          path,
          queryString,
          {
            parseDates: dateParser.current,
            documentDataConverter: documentConverter.current,
          }
        )
        unsubscribeRef.current = unsubscribe
        return initialData
      }

      const query: Ref = JSON.parse(queryString) ?? {}
      const ref = createRef(path, query, { documentDataConverter })
      const data: Doc[] = await ref.get().then(querySnapshot => {
        const array: typeof data = []
        querySnapshot.forEach(doc => {
          const docData =
            doc.data({
              serverTimestamps: 'estimate',
            }) ?? empty.object
          const docToAdd = withDocumentDatesParsed(
            {
              ...docData,
              id: doc.id,
              exists: doc.exists,
              hasPendingWrites: doc.metadata.hasPendingWrites,
            } as any,
            dateParser.current
          )
          // update individual docs in the cache
          mutateStatic(`${path}/${doc.id}`, docToAdd, false)
          if (
            isDev &&
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
  const mounted = useRef(false)
  useEffect(() => {
    if (mounted.current) revalidateRef.current()
    else mounted.current = true
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

  // add the collection to the cache,
  // so that we can mutate it from document calls later
  useEffect(() => {
    if (path) collectionCache.addCollectionToCache(path, memoQueryString)
  }, [path, memoQueryString])

  const { data, isValidating, revalidate, mutate, error } = swr

  /**
   * `add(data)`: Extends the Firestore document [`add` function](https://firebase.google.com/docs/firestore/manage-data/add-data).
   * - It also updates the local cache using SWR's `mutate`. This will prove highly convenient over the regular `add` function provided by Firestore.
   */
  const add = useCallback(
    (data: Data | Data[]) => {
      if (!path) return null

      const dataArray = Array.isArray(data) ? data : [data]

      const ref = fuego.db.collection(path)

      const docsToAdd: Doc[] = (dataArray.map(doc => ({
        ...doc,
        // generate IDs we can use that in the local cache that match the server
        id: ref.doc().id,
      })) as unknown) as Doc[] // solve this annoying TS bug 😅

      // add to cache
      if (!listen) {
        // we only update the local cache if we don't have a listener set up
        // why? because Firestore automatically handles this part for subscriptions
        mutate(prevState => {
          const state = prevState ?? empty.array
          return [...state, ...docsToAdd]
        }, false)
      }

      // add to network
      const batch = fuego.db.batch()

      docsToAdd.forEach(({ id, ...doc }) => {
        // take the ID out of the document
        let docRef = ref.doc(id)
        if (documentDataConverter) {
          docRef = docRef.withConverter(documentDataConverter)
        }
        batch.set(docRef, doc)
      })

      return batch.commit()
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
