export type ObjectPath<T, Key extends keyof T = keyof T> =
Key extends string
? T[Key] extends Record<string, any>
  ? | `${Key}.${ObjectPath<T[Key], Exclude<keyof T[Key], keyof Array<any>>> & string}`
    | `${Key}.${Exclude<keyof T[Key], keyof Array<any>> & string}`
    | Key
  : never
: never;