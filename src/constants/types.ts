import { UserRole } from 'src/entities'

export type KeyboardType = {
  webAppUrl?: string
  userRoles?: UserRole[]
  wishPagination?: { showed?: number; total?: number; sharedUserId?: string; createdAt?: string }
}

export type PaginatedKeyboardItem = {
  /**
   * command string
   */
  c: string
  /**
   * pagination property
   */
  p: {
    /**
     * showed, how items showed before
     */
    s?: number
    /**
     * total, how items total
     */
    t?: number
    /**
     * id, userId
     */
    i?: string
    /**
     * createdAt, unix timestamp
     */
    c?: number
  }
}
