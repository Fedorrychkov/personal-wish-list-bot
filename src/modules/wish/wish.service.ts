import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { getAnotherUserWishListById, getDeleteMessageToSubscriber, getMainKeyboards } from 'src/constants'
import { UserEntity, WishDocument, WishEntity } from 'src/entities'
import { TgInitUser } from 'src/types'
import { Telegraf } from 'telegraf'

import { CustomConfigService } from '../config'

@Injectable()
export class WishService {
  private telegraf: Telegraf

  constructor(
    private readonly wishEntity: WishEntity,
    private readonly userEntity: UserEntity,
    private readonly customConfigService: CustomConfigService,
  ) {
    this.telegraf = new Telegraf(this.customConfigService.tgToken)
  }

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

    const wish = response

    /**
     * При удалении желания, подписчку желания отправляется уведомление в чат
     */
    if (wish?.isBooked && wish.bookedUserId !== wish.userId) {
      const subscribedUser = await this.userEntity.get(wish.bookedUserId)

      const text = getDeleteMessageToSubscriber(wish?.name, user?.username)

      this.telegraf.telegram.sendMessage(subscribedUser?.chatId, text, {
        reply_markup: {
          inline_keyboard: [
            ...getMainKeyboards({ webAppUrl: this.customConfigService.miniAppUrl }),
            getAnotherUserWishListById(user?.id?.toString(), user?.username),
          ],
        },
      })
    }

    await this.wishEntity.delete(id)

    return { success: true }
  }
}
