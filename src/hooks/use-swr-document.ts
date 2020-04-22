import useSWR, { mutate, ConfigInterface } from 'swr'
import { fuego } from '../context'
import { useRef, useEffect, useCallback } from 'react'
import { empty } from '../helpers/empty'
import { Document } from '../types/Document'
import { SetOptions } from '@firebase/firestore-types'

type Options<Doc extends Document = Document> = {
  listen?: boolean
} & ConfigInterface<Doc | null>

const createListener = <Doc extends Document = Document>(
  path: string | null
) => {
  let data: Doc | null = null
  const unsubscribe = fuego.db.doc(path).onSnapshot(doc => {
    const docData = doc.data() ?? empty.object
    data = {
      ...docData,
      id: doc.id,
      exists: doc.exists,
      hasPendingWrites: doc.metadata.hasPendingWrites,
    } as any
    mutate(path, data, false)
  })
  return {
    latestData: () => data,
    unsubscribe,
  }
}
export const useDocument = <Doc extends Document = Document>(
  path: string | null,
  options: Options<Doc> = empty.object
) => {
  const unsubscribeRef = useRef<
    ReturnType<typeof createListener>['unsubscribe'] | null
  >(null)
  const { listen = false, ...swrOptions } = options

  const swr = useSWR<Doc | null>(
    path === null ? null : [path, listen],
    async (path: string, listen: boolean) => {
      if (listen) {
        if (unsubscribeRef.current) {
          unsubscribeRef.current()
        }
        const { unsubscribe, latestData } = createListener<Doc>(path)
        unsubscribeRef.current = unsubscribe
        return latestData()
      }
      const data: Doc = (await fuego.db
        .doc(path)
        .get()
        .then(doc => ({
          ...doc.data(),
          id: doc.id,
          exists: doc.exists,
        }))) as Doc
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
    // should depend on the path, and listen being the same...
  }, [path, listen])

  const set = useCallback(
    (
      data: Partial<Omit<Doc, 'id' | 'hasPendingWrites' | 'exists'>>,
      options?: SetOptions
    ) => {
      if (!listen) {
        // we only update the local cache if we don't have a listener set up
        mutate(path, (prevState = empty.object) => {
          // default we set merge to be true. but if it's false, then we don't merge old data
          if (options?.merge === false) return data
          return {
            ...prevState,
            ...data,
          }
        })
      }
      if (!path) return null
      return fuego.db.doc(path).set(data, options)
    },
    [path, listen]
  )

  const update = useCallback(
    (data: Partial<Omit<Doc, 'id' | 'hasPendingWrites' | 'exists'>>) => {
      if (!listen) {
        // we only update the local cache if we don't have a listener set up
        mutate(path, (prevState = empty.object) => {
          return {
            ...prevState,
            ...data,
          }
        })
      }
      if (!path) return null
      return fuego.db.doc(path).update(data)
    },
    [listen, path]
  )

  return { ...swr, set, update }
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
