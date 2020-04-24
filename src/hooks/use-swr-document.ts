import useSWR, { mutate, ConfigInterface } from 'swr'
import { fuego } from '../context'
import { useRef, useEffect, useCallback } from 'react'
import { empty } from '../helpers/empty'
import { Document } from '../types/Document'
import { SetOptions } from '@firebase/firestore-types'

type Options<Doc extends Document = Document> = {
  listen?: boolean
} & ConfigInterface<Doc | null>

// const createListener = <Doc extends Document = Document>(path: string) => {
//   let data: Doc | null = null
//   const unsubscribe = fuego.db.doc(path).onSnapshot(doc => {
//     const docData = doc.data() ?? empty.object
//     data = {
//       ...docData,
//       id: doc.id,
//       exists: doc.exists,
//       hasPendingWrites: doc.metadata.hasPendingWrites,
//     } as any
//     mutate([path, true], data, false)
//   })
//   return {
//     latestData: () => data,
//     unsubscribe,
//   }
// }

type ListenerReturnType<Doc extends Document = Document> = {
  initialData: Doc
  unsubscribe: ReturnType<ReturnType<typeof fuego['db']['doc']>['onSnapshot']>
}

const createListenerAsync = async <Doc extends Document = Document>(
  path: string
): Promise<ListenerReturnType<Doc>> => {
  return await new Promise(resolve => {
    const unsubscribe = fuego.db.doc(path).onSnapshot(doc => {
      const docData = doc.data() ?? empty.object
      const data = {
        ...docData,
        id: doc.id,
        exists: doc.exists,
        hasPendingWrites: doc.metadata.hasPendingWrites,
      } as any
      // the first time the listener fires, we resolve the promise with initial data
      resolve({
        initialData: data,
        unsubscribe,
      })
      mutate([path, true], data, false)
    })
  })
}

export const useDocument = <Doc extends Document = Document>(
  path: string | null,
  options: Options<Doc> = empty.object
) => {
  const unsubscribeRef = useRef<ListenerReturnType['unsubscribe'] | null>(null)
  const { listen = false, ...swrOptions } = options

  const swr = useSWR<Doc | null>(
    path === null ? null : [path, listen],
    async (path: string, listen: boolean) => {
      if (listen) {
        if (unsubscribeRef.current) {
          unsubscribeRef.current()
        }
        const { unsubscribe, initialData } = await createListenerAsync<Doc>(
          path
        )
        unsubscribeRef.current = unsubscribe
        return initialData
      }
      return (await fuego.db
        .doc(path)
        .get()
        .then(doc => ({
          ...doc.data(),
          id: doc.id,
          exists: doc.exists,
        }))) as Doc
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

  const { data, isValidating, revalidate, mutate: connectedMutate, error } = swr

  return {
    data,
    isValidating,
    revalidate,
    mutate: connectedMutate,
    error,
    set,
    update,
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
