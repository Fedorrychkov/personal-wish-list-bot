import { WishDocument } from 'src/entities'

export type WishPatchDto = {
  name?: WishDocument['name']
  description?: WishDocument['description']
  link?: WishDocument['link']
  imageUrl?: WishDocument['imageUrl']
}
