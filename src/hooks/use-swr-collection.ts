import useSWR, { mutate, ConfigInterface } from 'swr'
import { fuego } from '../context'
import { useRef, useEffect } from 'react'
import { useMemoOne as useMemo } from 'use-memo-one'
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
  startAt?: number | DocumentSnapshot
  endAt?: number | DocumentSnapshot
  startAfter?: number | DocumentSnapshot
  endBefore?: number | DocumentSnapshot
}

type Path = string
type Listen = boolean

type SwrKey = [Path, Listen, Ref]

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
  query: Ref = empty.object
) => {
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
    mutate(path, data, false)
  })

  return {
    latestData: () => data,
    unsubscribe,
  }
}

type Options<Doc extends Document = Document> = {
  listen?: boolean
} & ConfigInterface<Doc[] | null>

export const useDocument = <Doc extends Document = Document>(
  path: string,
  query: Ref = empty.object,
  options: Options<Doc> = empty.object
) => {
  const unsubscribeRef = useRef<
    ReturnType<typeof createListener>['unsubscribe'] | null
  >(null)
  const { listen = false, ...swrOptions } = options

  const { where, endAt, endBefore, startAfter, startAt, orderBy, limit } = query

  const memoQuery = useMemo(
    () => ({ where, endAt, endBefore, startAfter, startAt, orderBy, limit }),
    [endAt, endBefore, limit, orderBy, startAfter, startAt, where]
  )

  const key: SwrKey = [path, listen, memoQuery]

  const swr = useSWR<Doc[] | null>(
    key,
    async (...args: typeof key) => {
      const [path, listen, query] = args
      if (listen) {
        if (unsubscribeRef.current) {
          unsubscribeRef.current()
        }
        const { unsubscribe, latestData } = createListener<Doc>(path)
        unsubscribeRef.current = unsubscribe
        return latestData()
      }
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
    // should depend on the path, and listen being the same...
  }, [path, listen, memoQuery])

  return swr
}
