import React, { useContext } from 'react'
import { createContext, ReactNode } from 'react'
import { Fuego } from '../classes/Fuego'

type Context = {
  fuego: Fuego
}

// @ts-ignore
export const FuegoContext = createContext<Context>(null)

type Props = {
  children: ReactNode
  fuego: Fuego
}

export let fuego: Fuego

export const setFuego = (f: Fuego) => (fuego = f)

export const useFuegoContext = () => {
  const context = useContext(FuegoContext)
  return context
}

export const FuegoProvider = ({ children, fuego }: Props) => {
  setFuego(fuego)
  return (
    <FuegoContext.Provider value={{ fuego }}>{children}</FuegoContext.Provider>
  )
}
