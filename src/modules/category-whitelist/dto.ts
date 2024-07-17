import { CategoryWhitelistDocument } from 'src/entities'

export type CategoryWhitelistDto = {
  whitelistedUserId: CategoryWhitelistDocument['whitelistedUserId']
  categoryId: CategoryWhitelistDocument['categoryId']
}
