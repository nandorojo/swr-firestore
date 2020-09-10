import useSWR, { mutate, ConfigInterface } from 'swr'
import { SetOptions } from '@firebase/firestore-types'
import { fuego } from '../context'
import { useRef, useEffect, useCallback } from 'react'
import { empty } from '../helpers/empty'
import { Document } from '../types/Document'
import { collectionCache } from '../classes/Cache'
import { isDev } from '../helpers/is-dev'
import { withDocumentDatesParsed } from '../helpers/doc-date-parser'
import { deleteDocument } from './static-mutations'

type Options<Doc extends Document = Document> = {
  /**
   * If `true`, sets up a real-time subscription to the Firestore backend.
   *
   * Default: `false`
   */
  listen?: boolean
  /**
   * An array of key strings that indicate where there will be dates in the document.
   *
   * Example: if your dates are in the `lastUpdated` and `user.createdAt` fields, then pass `{parseDates: ["lastUpdated", "user.createdAt"]}`.
   *
   * This will automatically turn all Firestore dates into JS Date objects, removing the need to do `.toDate()` on your dates.
   */
  parseDates?: (
    | string
    | keyof Omit<Doc, 'id' | 'exists' | 'hasPendingWrites' | '__snapshot'>
  )[]
  /**
   * If `true`, doc returned in `data` will not include the firestore `__snapshot` field.
   *
   * If `false`, it will include a `__snapshot` field. This lets you access the document snapshot, but makes the document not JSON serializable.
   *
   * Default: `true`
   */
  ignoreFirestoreDocumentSnapshotField?: boolean
} & ConfigInterface<Doc | null>

type ListenerReturnType<Doc extends Document = Document> = {
  initialData: Doc
  unsubscribe: ReturnType<ReturnType<typeof fuego['db']['doc']>['onSnapshot']>
}

export const getDocument = async <Doc extends Document = Document>(
  path: string,
  {
    parseDates,
    ignoreFirestoreDocumentSnapshotField = true,
  }: {
    parseDates?: (
      | string
      | keyof Omit<Doc, 'id' | 'exists' | 'hasPendingWrites' | '__snapshot'>
    )[]
    /**
     * If `true`, doc returned in `data` will not include the firestore `__snapshot` field.
     *
     * If `false`, it will include a `__snapshot` field. This lets you access the document snapshot, but makes the document not JSON serializable.
     *
     * Default: `true`
     */
    ignoreFirestoreDocumentSnapshotField?: boolean
  } = empty.object
) => {
  const data = await fuego.db
    .doc(path)
    .get()
    .then(doc => {
      const docData =
        doc.data({
          serverTimestamps: 'estimate',
        }) ?? empty.object
      if (
        isDev &&
        // @ts-ignore
        (docData.exists || docData.id || docData.hasPendingWrites)
      ) {
        console.warn(
          '[get-document] warning: Your document, ',
          doc.id,
          ' is using one of the following reserved fields: [exists, id, hasPendingWrites]. These fields are reserved. Please remove them from your documents.'
        )
      }
      return withDocumentDatesParsed(
        ({
          ...docData,
          id: doc.id,
          exists: doc.exists,
          hasPendingWrites: doc.metadata.hasPendingWrites,
          __snapshot: ignoreFirestoreDocumentSnapshotField ? undefined : doc,
        } as unknown) as Doc,
        parseDates
      )
    })

  // update the document in any collections listening to the same document
  let collection: string | string[] = path.split(`/${data.id}`)

  collection.pop() // remove last item, which is the /id
  collection = collection.join('/') // rejoin the path
  if (collection) {
    collectionCache.getSWRKeysFromCollectionPath(collection).forEach(key => {
      mutate(
        key,
        (currentState: Doc[] = empty.array): Doc[] => {
          // don't mutate the current state if it doesn't include this doc
          if (!currentState.some(doc => doc.id === data.id)) {
            return currentState
          }
          return currentState.map(document => {
            if (document.id === data.id) {
              return data
            }
            return document
          })
        },
        false
      )
    })
  }

  return data
}

const createListenerAsync = async <Doc extends Document = Document>(
  path: string,
  {
    parseDates,
    ignoreFirestoreDocumentSnapshotField = true,
  }: {
    parseDates?: (
      | string
      | keyof Omit<Doc, 'id' | 'exists' | 'hasPendingWrites' | '__snapshot'>
    )[]
    /**
     * If `true`, `data` will not include the firestore `__snapshot` field. You might want this if you need your data to be JSON serializable.
     *
     * Default: `false`
     */
    ignoreFirestoreDocumentSnapshotField?: boolean
  } = {}
): Promise<ListenerReturnType<Doc>> => {
  return await new Promise(resolve => {
    const unsubscribe = fuego.db.doc(path).onSnapshot(doc => {
      const docData = doc.data() ?? empty.object
      const data = withDocumentDatesParsed<Doc>(
        ({
          ...docData,
          id: doc.id,
          exists: doc.exists,
          hasPendingWrites: doc.metadata.hasPendingWrites,
          __snapshot: ignoreFirestoreDocumentSnapshotField ? undefined : doc,
        } as unknown) as Doc,
        parseDates
      )
      mutate(path, data, false)
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

      // update the document in any collections listening to the same document
      let collection: string | string[] = path
        .split(`/${doc.id}`)
        .filter(Boolean)
      collection.pop() // remove last item, which is the /id
      collection = collection.join('/')

      if (collection) {
        collectionCache
          .getSWRKeysFromCollectionPath(collection)
          .forEach(key => {
            mutate(
              key,
              (currentState: Doc[] = empty.array): Doc[] => {
                // don't mutate the current state if it doesn't include this doc
                if (!currentState.some(doc => doc.id && doc.id === data.id)) {
                  return currentState
                }
                return currentState.map(document => {
                  if (document.id === data.id) {
                    return data
                  }
                  return document
                })
              },
              false
            )
          })
      }

      // the first time the listener fires, we resolve the promise with initial data
      resolve({
        initialData: data,
        unsubscribe,
      })
    })
  })
}

export const useDocument = <
  Data extends object = {},
  Doc extends Document = Document<Data>
>(
  path: string | null,
  options: Options<Doc> = empty.object
) => {
  const unsubscribeRef = useRef<ListenerReturnType['unsubscribe'] | null>(null)
  const {
    listen = false,
    parseDates,
    ignoreFirestoreDocumentSnapshotField = true,
    ...opts
  } = options

  // if we're listening, the firestore listener handles all revalidation
  const {
    refreshInterval = listen ? 0 : undefined,
    refreshWhenHidden = listen ? false : undefined,
    refreshWhenOffline = listen ? false : undefined,
    revalidateOnFocus = listen ? false : undefined,
    revalidateOnReconnect = listen ? false : undefined,
  } = options

  const swrOptions = {
    ...opts,
    refreshInterval,
    refreshWhenHidden,
    refreshWhenOffline,
    revalidateOnFocus,
    revalidateOnReconnect,
  }

  // we move listen to a Ref
  // why? because we shouldn't have to include "listen" in the key
  // if we do, then calling mutate() won't be consistent for all
  // documents with the same path.
  const shouldListen = useRef(listen)
  useEffect(() => {
    shouldListen.current = listen
  }, [listen])

  const datesToParse = useRef(parseDates)
  useEffect(() => {
    datesToParse.current = parseDates
  }, [parseDates])

  const shouldIgnoreSnapshot = useRef(ignoreFirestoreDocumentSnapshotField)
  useEffect(() => {
    shouldIgnoreSnapshot.current = ignoreFirestoreDocumentSnapshotField
  }, [ignoreFirestoreDocumentSnapshotField])

  const swr = useSWR<Doc | null>(
    path,
    async (path: string) => {
      if (shouldListen.current) {
        if (unsubscribeRef.current) {
          unsubscribeRef.current()
          unsubscribeRef.current = null
        }
        const { unsubscribe, initialData } = await createListenerAsync<Doc>(
          path,
          {
            parseDates: datesToParse.current,
            ignoreFirestoreDocumentSnapshotField: shouldIgnoreSnapshot.current,
          }
        )
        unsubscribeRef.current = unsubscribe
        return initialData
      }
      const data = await getDocument<Doc>(path, {
        parseDates: datesToParse.current,
        ignoreFirestoreDocumentSnapshotField: shouldIgnoreSnapshot.current,
      })
      return data
    },
    swrOptions
  )

  const { data, isValidating, revalidate, mutate: connectedMutate, error } = swr

  // if listen changes,
  // we run revalidate.
  // This triggers SWR to fetch again
  // Why? because we don't want to put listen or memoQueryString
  // in the useSWR key. If we did, then we couldn't mutate
  // based on path. If we had useSWR(['users', { where: ['name', '==, 'fernando']}]),
  // and we updated the proper `user` dictionary, it wouldn't mutate, because of
  // the key.
  // thus, we move the `listen` and `queryString` options to refs passed to `useSWR`,
  // and we call `revalidate` if either of them change.
  const mounted = useRef(false)
  useEffect(() => {
    if (mounted.current) revalidateRef.current()
    else mounted.current = true
  }, [listen])

  // this MUST be after the previous effect to avoid duplicate initial validations.
  // only happens on updates, not initial mount.
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
    // should depend on the path, and listen being the same...
  }, [path, listen])

  /**
   * `set(data, SetOptions?)`: Extends the `firestore` document `set` function.
   * - You can call this when you want to edit your document.
   * - It also updates the local cache using SWR's `mutate`. This will prove highly convenient over the regular Firestore `set` function.
   * - The second argument is the same as the second argument for [Firestore `set`](https://firebase.google.com/docs/firestore/manage-data/add-data#set_a_document).
   */
  const set = useCallback(
    (data: Partial<Data>, options?: SetOptions) => {
      if (!listen) {
        // we only update the local cache if we don't have a listener set up
        // Why? firestore handles this for us for listeners.
        // @ts-ignore
        connectedMutate((prevState = empty.object) => {
          // default we set merge to be false. this is annoying, but follows Firestore's preference.
          if (!options?.merge) return data
          return {
            ...prevState,
            ...data,
          }
        })
      }
      if (!path) return null
      return fuego.db.doc(path).set(data, options)
    },
    [path, listen, connectedMutate]
  )

  /**
   * - `update(data)`: Extends the Firestore document [`update` function](https://firebase.google.com/docs/firestore/manage-data/add-data#update-data).
   * - It also updates the local cache using SWR's `mutate`. This will prove highly convenient over the regular `set` function.
   */
  const update = useCallback(
    (data: Partial<Data>) => {
      if (!listen) {
        // we only update the local cache if we don't have a listener set up
        // @ts-ignore
        connectedMutate((prevState = empty.object) => {
          return {
            ...prevState,
            ...data,
          }
        })
      }
      if (!path) return null
      return fuego.db.doc(path).update(data)
    },
    [listen, path, connectedMutate]
  )

  const connectedDelete = useCallback(() => {
    return deleteDocument(path, listen)
  }, [path, listen])

  return {
    data,
    isValidating,
    revalidate,
    mutate: connectedMutate,
    error,
    set,
    update,
    loading: !data && !error,
    deleteDocument: connectedDelete,
  }
}

// const useSubscription = (path: string) => {
//   const unsubscribeRef = useRef<
//     ReturnType<typeof createListener>['unsubscribe'] | null
//   >(null)

//   const swr = useSWR([path], path => {
//     const { unsubscribe, latestData } = createListener(path)
//     unsubscribeRef.current = unsubscribe
//     return latestData()
//   })

//   useEffect(() => {
//     return () => {
//       if (unsubscribeRef.current) {
//         unsubscribeRef.current()
//       }
//     }
//   }, [path])
//   return swr
// }
