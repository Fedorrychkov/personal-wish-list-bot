import { WishDocument, WishStatus } from 'src/entities'

export type WishPatchDto = {
  name?: WishDocument['name']
  description?: WishDocument['description']
  link?: WishDocument['link']
  imageUrl?: WishDocument['imageUrl']
}

export type WishFilterDto = {
  categoryId?: string
  status?: WishStatus
}
