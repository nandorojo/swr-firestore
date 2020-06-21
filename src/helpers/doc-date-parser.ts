import { set, get } from 'lodash'

export function withDocumentDatesParsed<Data extends object>(
  data: Data,
  parseDates?: (keyof Data | string)[]
) {
  const doc = { ...data }
  parseDates?.forEach(dateField => {
    if (typeof dateField !== 'string') return

    const unparsedDate = get(doc, dateField)
    if (unparsedDate) {
      const parsedDate: Date | undefined = unparsedDate.toDate?.()
      if (parsedDate) {
        set(doc, dateField, parsedDate)
      }
    }
  })

  return doc
}
