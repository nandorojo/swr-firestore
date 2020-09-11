import { Document } from '../types'
import {
  CollectionQueryType,
  CollectionSWROptions,
  useCollection,
} from './use-swr-collection'

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
  return useCollection<Data>(
    collection,
    {
      ...query,
      isCollectionGroup: true,
    },
    swrOptions as any
  )
}
