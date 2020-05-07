import { empty } from '../helpers/empty'

type Collections = {
  [path: string]: {
    key: [string, string | undefined] // [path, queryString]
  }[]
}

/**
 * Collection cache
 *
 * This helps us keep track of which collections have been created.
 *
 * Whenever we edit a document, we then check the collection cache to see which collections we should also update.
 */
class CollectionCache {
  private collections: Collections
  constructor() {
    this.collections = {}
  }

  getSWRKeysFromCollectionPath(path: string) {
    const isCollection =
      path
        .trim()
        .split('/')
        .filter(Boolean).length %
        2 !==
      0
    if (!isCollection) {
      console.error(
        `[fuego-swr-keys-from-collection-path] error: Passed a path that was not a collection to useCollection: ${path}.`
      )
    }
    return (
      this.collections[path]
        ?.map(({ key }) =>
          // if the queryString is undefined, take it out of the array
          key.filter(keyItem => typeof keyItem === 'string')
        )
        .filter(Boolean) ?? empty.array
    )
  }
  addCollectionToCache(path: string, queryString?: string) {
    const collectionAlreadyExistsInCache = this.collections[path]?.some(
      ({ key }) => key[0] === path && key[1] === queryString
    )
    if (!collectionAlreadyExistsInCache) {
      this.collections = {
        ...this.collections,
        [path]: [
          ...(this.collections[path] ?? empty.array),
          {
            key: [path, queryString],
          },
        ],
      }
    }
    return this.collections
  }
}

export const collectionCache = new CollectionCache()
