export type SantaPlayerFilter = {
  /**
   * player id
   */
  userId?: string
  /**
   * Record id
   */
  id?: string
  /**
   * Game id
   */
  santaGameId?: string
  /**
   * Кому дарит подарок
   */
  santaRecipientUserId?: string
  isGameFinished?: boolean
  isSantaConfirmed?: boolean
}
