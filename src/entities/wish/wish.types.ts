export type WishFilter = {
  userId?: string
  categoryId?: string
  status?: WishStatus
  limit?: number
  createdAt?: string
}

export enum WishStatus {
  ACTIVE = 'ACTIVE',
  GIVEN = 'GIVEN',
}
