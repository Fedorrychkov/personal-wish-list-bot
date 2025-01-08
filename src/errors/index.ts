import { errors as favoriteErrors } from './favorites'
import { errors as gameErrors } from './game'
import { errors as transactionErrors } from './transaction'
import { errors as userErrors } from './user'
import { errors as wishErrors } from './wish'

export const ERROR_CODES = {
  wish: wishErrors,
  user: userErrors,
  favorite: favoriteErrors,
  game: gameErrors,
  transaction: transactionErrors,
}
