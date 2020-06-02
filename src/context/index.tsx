import React, { useEffect, useContext } from 'react'
import { createContext, ReactNode } from 'react'
import { Fuego } from '../classes/Fuego'

// @ts-ignore
type Context = {
  fuego: Fuego
  // listeners: {
  // 	[name: string]: null | Listener
  // }
  // addListener: (name: string, listener: Listener) => void
  // unsubscribeListener: (name: string) => void
}

// @ts-ignore
export const FuegoContext = createContext<Context>(null)

type Props = {
  children: ReactNode
  fuego: Fuego
}

export let fuego: Fuego

export const setFuego = (f: Fuego) => (fuego = f)

// type Listener = {
//   unsubscribe: ReturnType<firebase.firestore.DocumentReference['onSnapshot']>
//   updateData: <T>(docOrCollection: T) => void
// }

export const useFuegoContext = () => {
  const context = useContext(FuegoContext)
  return context
}

export const FuegoProvider = ({ children, fuego }: Props) => {
  // const [listeners, setListeners] = useState<Context['listeners']>({})

  setFuego(fuego)
  // useEffect(() => {
  //   fuego = f
  // }, [f])

  // const listeners = useRef<{
  // 	[name: string]: null | {
  // 		listener: ReturnType<
  // 			firebase.firestore.DocumentReference['onSnapshot']
  // 		>
  // 		updateData: (docOrCollection: any) => {}
  // 	}
  // }>({})

  // const addListener = useCallback(
  // 	(name: string, listener: Listener) => {
  // 		setListeners(state => {
  // 			if (state[name]) {
  // 				console.warn(
  // 					`Fuego listener error. Tried to add ${name} listener, but it already exists. This still worked, but using redux might be a better solution.`
  // 				)
  // 			}
  // 			if (
  // 				Object.entries(listeners).filter(
  // 					([_, listener]) => listener
  // 				).length > 4
  // 			) {
  // 				console.warn(
  // 					`You have ${Object.keys(
  // 						listeners
  // 					)} listener(s) open. You may want to unsubscribe. Open: ${Object.keys(
  // 						listeners
  // 					)}`
  // 				)
  // 			}
  // 			return { ...state, [name]: listener }
  // 		})
  // 	},
  // 	[listeners]
  // )
  // const unsubscribeListener = useCallback((name: string) => {
  // 	setListeners(state => ({ ...state, [name]: null }))
  // }, [])

  return (
    <FuegoContext.Provider value={{ fuego }}>{children}</FuegoContext.Provider>
  )
}
