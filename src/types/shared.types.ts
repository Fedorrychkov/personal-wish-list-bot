export type AnyString = string & NonNullable<unknown>

export type ValuesMap<T extends AnyString, K> = {
  [Key in T]: K
}

export type AnyCurrency = 'XTR' | 'TON' | AnyString

export type PaginationResponse<T> = {
  list: T[]
  total: number
}
