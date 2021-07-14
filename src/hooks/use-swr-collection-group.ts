import { CollectionQueryType } from '../types/Query'
import { Document } from '../types'
import { CollectionSWROptions, useCollection } from './use-swr-collection'

// type UseCollection = Parameters<typeof useCollection>

/**
 *
 * 🚨 Experimental. I recommend only using this only to test for now. There are some edge cases still being figured out for caching collection groups.
 */
export const useExperimentalCollectionGroup = <
  Data extends object = {},
  Doc extends Document = Document<Data>
>(
  collection: string | null,
  query: Omit<CollectionQueryType<Data>, 'isCollectionGroup'>,
  swrOptions: CollectionSWROptions<Doc>
) => {
  console.warn(
    '[swr-firestore] useExperimentalCollectionGroup is deprecated. Switch to useCollectionGroup.'
  )
  return useCollection<Data>(
    collection,
    {
      ...query,
      isCollectionGroup: true,
    },
    swrOptions as any
  )
}

export const useCollectionGroup = <
  Data extends object = {},
  Doc extends Document = Document<Data>
>(
  collection: string | null,
  query: Omit<CollectionQueryType<Data>, 'isCollectionGroup'>,
  swrOptions: CollectionSWROptions<Doc>
) => {
  return useCollection<Data>(
    collection,
    {
      ...query,
      isCollectionGroup: true,
    },
    swrOptions as any
  )
}
