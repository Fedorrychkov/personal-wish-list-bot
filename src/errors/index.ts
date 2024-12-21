import { errors as favoriteErrors } from './favorites'
import { errors as userErrors } from './user'
import { errors as wishErrors } from './wish'

export const ERROR_CODES = {
  wish: wishErrors,
  user: userErrors,
  favorite: favoriteErrors,
}
