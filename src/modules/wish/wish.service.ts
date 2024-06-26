import {
  BadGatewayException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common'
import { getAnotherUserWishListById, getDeleteMessageToSubscriber, getMainKeyboards } from 'src/constants'
import { UserEntity, WishDocument, WishEntity } from 'src/entities'
import { ERROR_CODES } from 'src/errors'
import { TgInitUser } from 'src/types'
import { Telegraf } from 'telegraf'

import { CustomConfigService } from '../config'
import { WishPatchDto } from './dto'

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

  private validateNotFound(wish: WishDocument) {
    if (!wish) {
      const code = ERROR_CODES.wish.codes.WISH_NOT_FOUND
      const message = ERROR_CODES.wish.messages[code]

      throw new NotFoundException({
        code,
        message,
      })
    }
  }

  public async getList(user: TgInitUser): Promise<WishDocument[]> {
    const { id } = user || {}

    const response = await this.wishEntity.findAll({ userId: id?.toString() })

    return response
  }

  public async getItem(id: string): Promise<WishDocument> {
    const response = await this.wishEntity.get(id)

    this.validateNotFound(response)

    return response
  }

  public async update(user: TgInitUser, id: string, body: WishPatchDto): Promise<WishDocument> {
    const { data: response, doc } = await this.wishEntity.getUpdate(id)

    this.validateNotFound(response)

    if (response?.userId !== user?.id?.toString()) {
      const code = ERROR_CODES.wish.codes.WISH_PERMISSION_DENIED
      const message = ERROR_CODES.wish.messages[code]

      throw new ForbiddenException({
        code,
        message,
      })
    }

    const payload = this.wishEntity.getValidProperties({ ...response, ...body })
    await doc.update(payload)

    return payload
  }

  public async bookToggle(user: TgInitUser, id: string): Promise<WishDocument> {
    const { doc, data: response } = await this.wishEntity.getUpdate(id)

    this.validateNotFound(response)

    const userId = user?.id?.toString()

    if (response?.isBooked && response?.bookedUserId !== userId) {
      const code = ERROR_CODES.wish.codes.WISH_BOOKED_SOMEBODY
      const message = ERROR_CODES.wish.messages[code]

      throw new BadGatewayException({
        code,
        message,
      })
    }

    if (response?.isBooked && response.bookedUserId === userId) {
      const payload = this.wishEntity.getValidProperties({ ...response, isBooked: false, bookedUserId: null })
      await doc.update(payload)

      return payload
    }

    if (!response?.isBooked) {
      const payload = this.wishEntity.getValidProperties({ ...response, isBooked: true, bookedUserId: userId })
      await doc.update(payload)

      return payload
    }

    throw new InternalServerErrorException('Something goes wrong...')
  }

  public async deleteItem(user: TgInitUser, id: string) {
    const response = await this.wishEntity.get(id)

    this.validateNotFound(response)

    if (response?.userId !== user?.id?.toString()) {
      const code = ERROR_CODES.wish.codes.WISH_PERMISSION_DENIED
      const message = ERROR_CODES.wish.messages[code]

      throw new ForbiddenException({
        code,
        message,
      })
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
