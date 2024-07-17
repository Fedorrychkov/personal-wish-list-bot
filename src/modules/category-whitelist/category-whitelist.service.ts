import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { getMainOpenWebAppButton } from 'src/constants'
import {
  CategoryWhitelistDocument,
  CategoryWhitelistEntity,
  CategoryWhitelistFilter,
  CategroyEntity,
  FavoriteDocument,
  UserEntity,
} from 'src/entities'
import { TgInitUser } from 'src/types'
import { Telegraf } from 'telegraf'

import { CustomConfigService } from '../config'
import { FavoriteService } from '../favorite'
import { CategoryWhitelistDto } from './dto'

@Injectable()
export class CategoryWhitelistService {
  private telegraf: Telegraf
  private readonly logger = new Logger(CategoryWhitelistService.name)

  constructor(
    private readonly categoryWhitelistEntity: CategoryWhitelistEntity,
    private readonly customConfigService: CustomConfigService,
    private readonly favoriteService: FavoriteService,
    private readonly userEntity: UserEntity,
    private readonly categroyEntity: CategroyEntity,
  ) {
    this.telegraf = new Telegraf(this.customConfigService.tgToken)
  }

  public async getList(id: string | number, filter?: CategoryWhitelistFilter): Promise<CategoryWhitelistDocument[]> {
    const response = await this.categoryWhitelistEntity.findAll({ ...filter, userId: id?.toString() })

    return response
  }

  public async create(user: TgInitUser, body: CategoryWhitelistDto): Promise<CategoryWhitelistDocument> {
    const payload = this.categoryWhitelistEntity.getValidProperties({
      ...body,
      userId: user?.id?.toString(),
    })

    const subscriber = await this.favoriteService.getSubscriber(payload?.whitelistedUserId, payload?.userId)

    if (subscriber?.wishlistNotifyEnabled) {
      this.notifySubscriber(user, subscriber, payload, 'add')
    }

    const response = this.categoryWhitelistEntity.createOrUpdate(payload)

    return response
  }

  public async delete(user: TgInitUser, id: string): Promise<{ success: boolean; id: string }> {
    const response = await this.categoryWhitelistEntity.get(id)

    if (response && user?.id?.toString() !== response?.userId) {
      throw new ForbiddenException('You cannot delete different user whitelist record')
    }

    if (!response) {
      throw new NotFoundException('Whitelist record does not exist')
    }

    await this.categoryWhitelistEntity.delete(id)

    const subscriber = await this.favoriteService.getSubscriber(response?.whitelistedUserId, response?.userId)

    if (subscriber?.wishlistNotifyEnabled) {
      this.notifySubscriber(user, subscriber, response, 'remove')
    }

    return { success: true, id }
  }

  private async notifySubscriber(
    owner: TgInitUser,
    subscriber: FavoriteDocument,
    whitelist: CategoryWhitelistDocument,
    type: 'add' | 'remove',
  ) {
    const subscribedUser = await this.userEntity.get(subscriber?.userId)

    if (!subscribedUser) return

    const category = await this.categroyEntity.get(whitelist.categoryId)

    const text = `Пользователь @${owner?.username || owner?.id} ${
      type === 'remove' ? 'удалил вас из приватной категории' : 'добавил вас в приватную категорию'
    } ${category?.name || ' Без названия'}`

    await this.telegraf.telegram.sendMessage(subscribedUser?.chatId, text, {
      reply_markup: {
        inline_keyboard: [
          [getMainOpenWebAppButton(`${this.customConfigService.miniAppUrl}/user/${owner?.id}`, 'Открыть')],
        ],
      },
    })
  }
}
