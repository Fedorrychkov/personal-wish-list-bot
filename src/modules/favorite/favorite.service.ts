import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { FavoriteDocument, FavoriteEntity } from 'src/entities'
import { TgInitUser } from 'src/types'

import { FavoriteDto } from './dto'

@Injectable()
export class FavoriteService {
  private readonly logger = new Logger(FavoriteService.name)

  constructor(private readonly favoriteEntity: FavoriteEntity) {}

  public async getList(id: string | number): Promise<FavoriteDocument[]> {
    const response = await this.favoriteEntity.findAll({ userId: id?.toString() })

    return response
  }

  public async getItem(user: TgInitUser, favoriteUserId: string): Promise<FavoriteDocument> {
    const [favorite] = await this.favoriteEntity.findAll({ userId: user?.id?.toString(), favoriteUserId })

    if (!favorite) {
      throw new NotFoundException('Favorite not found')
    }

    return favorite
  }

  public async delete(user: TgInitUser, favoriteUserId: string): Promise<{ success: true }> {
    const [favorite] = await this.favoriteEntity.findAll({ userId: user?.id?.toString(), favoriteUserId })

    favorite ? await this.favoriteEntity.delete(favorite.id) : {}

    return { success: true }
  }

  public async create(user: TgInitUser, dto: FavoriteDto): Promise<FavoriteDocument> {
    const wishlistNotifyEnabled =
      typeof dto.wishlistNotifyEnabled === 'string' ? dto.wishlistNotifyEnabled === 'true' : dto.wishlistNotifyEnabled

    const payload = this.favoriteEntity.getValidProperties({
      ...dto,
      wishlistNotifyEnabled,
      userId: user?.id?.toString(),
    })

    return this.favoriteEntity.createOrUpdate(payload)
  }

  public async update(user: TgInitUser, dto: FavoriteDto): Promise<FavoriteDocument> {
    const [favorite] = await this.favoriteEntity.findAll({
      userId: user?.id?.toString(),
      favoriteUserId: dto.favoriteUserId,
    })

    const { doc, data } = await this.favoriteEntity.getUpdate(favorite?.id)

    if (!data) {
      throw new NotFoundException('Favorite not found')
    }

    const wishlistNotifyEnabled =
      typeof dto.wishlistNotifyEnabled === 'string' ? dto.wishlistNotifyEnabled === 'true' : dto.wishlistNotifyEnabled

    const payload = {
      ...favorite,
      wishlistNotifyEnabled,
    }

    doc.update({ wishlistNotifyEnabled })

    return payload
  }
}
