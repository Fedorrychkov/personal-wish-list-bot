export type SantaFilter = {
  /**
   * Game owner id
   */
  userId?: string
  /**
   * Game id
   */
  id?: string
  /**
   * Game status
   */
  status?: GameStatus
  statuses?: GameStatus[]
}

export enum GameStatus {
  CREATED = 'CREATED',
  ACTIVE = 'ACTIVE',
  CANCELLED = 'CANCELLED',
  FINISHED = 'FINISHED',
}
