import React, { useContext } from 'react'
import { createContext, ReactNode } from 'react'
import { FireSWR } from '../classes/FireSWR'

type Context = {
  fireSWR: FireSWR
}

// @ts-ignore
export const FireSWRContext = createContext<Context>(null)

type Props = {
  children: ReactNode
  fireSWR: FireSWR
}

export let fireSWR: FireSWR

export const setFireSWR = (f: FireSWR) => (fireSWR = f)

export const useFireSWRContext = () => {
  const context = useContext(FireSWRContext)
  return context
}

export const FireSWRProvider = ({ children, fireSWR }: Props) => {
  setFireSWR(fireSWR)
  return (
    <FireSWRContext.Provider value={{ fireSWR }}>{children}</FireSWRContext.Provider>
  )
}
