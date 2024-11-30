export type WishFilter = {
  userId?: string
  categoryId?: string
  status?: WishStatus
}

export enum WishStatus {
  ACTIVE = 'ACTIVE',
  GIVEN = 'GIVEN',
}
