// import {
// 	useMemo,
// 	useCallback,
// 	useState,
// 	useEffect,
// 	useContext,
// 	useRef,
// } from 'react'
// import { fuego } from 'src/context'
// import { empty } from 'src/helpers/empty'
// import { FuegoContext } from '../context/index'

// type Options = {
// 	listen?: boolean
// }

// export function useDocument<
// 	Doc extends { id: string; exists: boolean } = {
// 		id: string
// 		exists: boolean
// 	}
// >(path: string, options: Options = empty.object) {
// 	const { addListener, unsubscribeListener } = useContext(FuegoContext)
// 	const [data, setData] = useState<Doc | null>(null)
// 	const [loading, setLoading] = useState(false)
// 	const ref = useMemo(() => {
// 		return fuego.db.doc(path)
// 	}, [path])

// 	const { listen = false } = options
// 	const unsubscribe = useRef<ReturnType<
// 		firebase.firestore.DocumentReference['onSnapshot']
// 	> | null>(null)

// 	const get = useCallback(() => {
// 		setLoading(true)
// 		ref.get().then(doc => {
// 			const docData = doc.data() as Omit<Doc, 'id' | 'exists'>
// 			const document: Doc = {
// 				...docData,
// 				id: doc.id,
// 				exists: doc.exists,
// 			}
// 			setData(document)
// 			setLoading(false)
// 		})
// 	}, [ref])
// 	const listener = useCallback(() => {
// 		setLoading(true)
// 		unsubscribe.current = ref.onSnapshot(doc => {
// 			const docData = doc.data()
// 			const document: Doc = {
// 				...docData,
// 				id: doc.id,
// 				exists: doc.exists,
// 			}
// 			setData(document)
// 			setLoading(false)
// 		})
// 		addListener(path, {
// 			unsubscribe: unsubscribe.current,
// 			updateData: setData,
// 		})

// 		return unsubscribe.current
// 	}, [addListener, path, ref])

// 	useEffect(() => {
// 		let unsubscribe: ReturnType<typeof listener>
// 		if (listen) {
// 			unsubscribe = listener()
// 		} else {
// 			get()
// 		}
// 		return () => {
// 			unsubscribe?.()
// 			unsubscribeListener(path)
// 		}
// 	}, [get, listen, listener, path, unsubscribeListener])

// 	return {
// 		data,
// 		loading,
// 		refetch: get,
// 		unsubscribe: unsubscribe.current,
// 		resubscribe: listener,
// 	}
// }
