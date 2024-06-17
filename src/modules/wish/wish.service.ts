import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { WishDocument, WishEntity } from 'src/entities'
import { TgInitUser } from 'src/types'

@Injectable()
export class WishService {
  constructor(private wishEntity: WishEntity) {}

  public async getList(user: TgInitUser): Promise<WishDocument[]> {
    const { id } = user || {}

    const response = await this.wishEntity.findAll({ userId: id?.toString() })

    return response
  }

  public async getItem(id: string): Promise<WishDocument> {
    const response = await this.wishEntity.get(id)

    return response
  }

  public async deleteItem(user: TgInitUser, id: string) {
    const response = await this.wishEntity.get(id)

    if (!response) {
      throw new NotFoundException('Wish is not found')
    }

    if (response?.userId !== user?.id?.toString()) {
      throw new ForbiddenException('You can not permission to delete this wish')
    }

    await this.wishEntity.delete(id)

    return { success: true }
  }
}
