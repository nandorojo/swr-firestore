import {
	useMemo,
	useCallback,
	useState,
	useEffect,
	useContext,
	useRef,
} from 'react'
import { fuego } from 'src/context'
import { empty } from 'src/helpers/empty'
import { FuegoContext } from '../context/index'

import {
	DocumentSnapshot,
	FieldPath,
	OrderByDirection,
	WhereFilterOp,
	Query,
} from '@firebase/firestore-types'

export type OrderByArray = [string | FieldPath, OrderByDirection]
export type OrderByItem = OrderByArray | string
export type OrderByType = OrderByItem | OrderByArray[]

export type WhereItem = [string | FieldPath, WhereFilterOp, unknown]
export type WhereArray = WhereItem[]
export type WhereType = WhereItem | WhereArray

type Options = {
	orderBy?: OrderByType
	where?: WhereType
	limit?: number
	startAt?: number | DocumentSnapshot
	endAt?: number | DocumentSnapshot
	startAfter?: number | DocumentSnapshot
	endBefore?: number | DocumentSnapshot

	listen?: boolean
}

export function useCollection<
	Doc extends { id: string; exists: boolean } = {
		id: string
		exists: boolean
	}
>(path: string, options: Options = empty.object) {
	const { addListener, unsubscribeListener } = useContext(FuegoContext)
	const [data, setData] = useState<Doc | null>(null)
	const [loading, setLoading] = useState(false)
	const {
		where,
		orderBy,
		limit,
		startAt,
		endAt,
		startAfter,
		endBefore,
	} = options
	const ref = useMemo(() => {
		let ref: Query = fuego.db.collection(path)

		if (where) {
			function multipleConditions(w: WhereType): w is WhereArray {
				return !!(w as WhereArray) && Array.isArray(w[0])
			}
			if (multipleConditions(where)) {
				where.forEach(w => {
					ref = ref.where(w[0], w[1], w[2])
				})
			} else if (
				typeof where[0] === 'string' &&
				typeof where[1] === 'string'
			) {
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
	}, [endAt, endBefore, limit, orderBy, path, startAfter, startAt, where])

	const { listen = false } = options
	const unsubscribe = useRef<ReturnType<
		firebase.firestore.DocumentReference['onSnapshot']
	> | null>(null)

	const get = useCallback(() => {
		setLoading(true)
		ref.get().then(snapshot => {
			const arr: Doc[] = []
			snapshot.forEach(doc => {
				const docData = doc.data()
				const document: Doc = {
					...docData,
					id: doc.id,
					exists: doc.exists,
				}
				arr.push(document)
				setLoading(false)
			})
			setData(arr)
		})
	}, [ref])
	const listener = useCallback(() => {
		setLoading(true)
		unsubscribe.current = ref.onSnapshot(doc => {
			const docData = doc.data()
			const document: Doc = {
				...docData,
				id: doc.id,
				exists: doc.exists,
			}
			setData(document)
			setLoading(false)
		})
		addListener(path, {
			unsubscribe: unsubscribe.current,
			updateData: setData,
		})

		return unsubscribe.current
	}, [addListener, path, ref])

	useEffect(() => {
		let unsubscribe: ReturnType<typeof listener>
		if (listen) {
			unsubscribe = listener()
		} else {
			get()
		}
		return () => {
			unsubscribe?.()
			unsubscribeListener(path)
		}
	}, [get, listen, listener, path, unsubscribeListener])

	return {
		data,
		loading,
		refetch: get,
		unsubscribe: unsubscribe.current,
		resubscribe: listener,
	}
}
