export type SerializerOptions =
  | {
      type: 'date' | 'ref'
    }
  | {
      type: 'snapshot'
      path: string
    }
