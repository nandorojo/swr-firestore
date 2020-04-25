import { mutate } from 'swr'
import { SetOptions } from '@firebase/firestore-types'
import { fuego } from '../context'
import { empty } from '../helpers/empty'

const set = <Doc extends Document = Document>(
  path: string | null,
  data: Partial<Omit<Doc, 'id' | 'hasPendingWrites' | 'exists'>>,
  options?: SetOptions
) => {
  if (!path) return null

  mutate(path, (prevState = empty.object) => {
    // default we set merge to be true. but if it's false, then we don't merge old data
    if (options?.merge === false) return data
    return {
      ...prevState,
      ...data,
    }
  })
  if (!path) return null
  return fuego.db.doc(path).set(data, options)
}

const update = <Doc extends Document = Document>(
  path: string | null,
  data: Partial<Omit<Doc, 'id' | 'hasPendingWrites' | 'exists'>>
) => {
  if (!path) return null
  mutate(path, (prevState = empty.object) => {
    return {
      ...prevState,
      ...data,
    }
  })
  return fuego.db.doc(path).update(data)
}

export { set, update }
