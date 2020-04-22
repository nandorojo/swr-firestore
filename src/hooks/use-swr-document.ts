import useSWR, { mutate, ConfigInterface } from 'swr'
import { fuego } from 'src/context'
import { useRef, useEffect } from 'react'
import { empty } from 'src/helpers/empty'
import { Document } from 'src/types/Document'

type Options<Doc extends Document = Document> = {
  listen?: boolean
} & ConfigInterface<Doc | null>

const createListener = <Doc extends Document = Document>(path: string) => {
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
  path: string,
  options: Options<Doc> = empty.object
) => {
  const unsubscribeRef = useRef<
    ReturnType<typeof createListener>['unsubscribe'] | null
  >(null)
  const { listen = false, ...swrOptions } = options

  const swr = useSWR<Doc | null>(
    [path, listen],
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

  return swr
}

const useSubscription = (path: string) => {
  const unsubscribeRef = useRef<
    ReturnType<typeof createListener>['unsubscribe'] | null
  >(null)

  const swr = useSWR([path], path => {
    const { unsubscribe, latestData } = createListener(path)
    unsubscribeRef.current = unsubscribe
    return latestData()
  })

  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
      }
    }
  }, [path])
  return swr
}
