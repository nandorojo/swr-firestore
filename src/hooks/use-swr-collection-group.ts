import { useCollection } from './use-swr-collection'

type UseCollection = Parameters<typeof useCollection>

/**
 *
 * 🚨 Experimental. I recommend only using this only to test for now. There are some edge cases still being figured out for caching collection groups.
 */
export const useExperimentalCollectionGroup = (
  collection: string | null,
  query: Omit<UseCollection[1], 'isCollectionGroup'>,
  options: UseCollection[2]
) => {
  return useCollection(
    collection,
    {
      ...query,
      __unstableCollectionGroup: true,
    },
    options
  )
}
