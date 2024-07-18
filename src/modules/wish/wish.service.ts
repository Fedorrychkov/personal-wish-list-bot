import {
  BadGatewayException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import {
  getAnotherUserWishListById,
  getDeleteMessageToSubscriber,
  getMainKeyboards,
  getOwnerWishItemKeyboard,
  getWishFavoriteKeyboard,
} from 'src/constants'
import { FavoriteDocument, UserEntity, WishDocument, WishEntity } from 'src/entities'
import { ERROR_CODES } from 'src/errors'
import { BucketProvider, BucketSharedService, DefaultBucketProvider } from 'src/services'
import { TgInitUser } from 'src/types'
import { Telegraf } from 'telegraf'

import { CategoryService } from '../category'
import { CategoryWhitelistService } from '../category-whitelist'
import { CustomConfigService } from '../config'
import { FavoriteService } from '../favorite'
import { WishFilterDto, WishPatchDto } from './dto'

@Injectable()
export class WishService {
  private telegraf: Telegraf
  private bucketService: BucketSharedService
  private readonly logger = new Logger(WishService.name)

  constructor(
    private readonly wishEntity: WishEntity,
    private readonly userEntity: UserEntity,
    private readonly customConfigService: CustomConfigService,
    @Inject(DefaultBucketProvider.bucketName)
    private readonly bucketProvider: BucketProvider,
    private readonly favoriteService: FavoriteService,
    private readonly categoryService: CategoryService,
    private readonly categoryWhitelistService: CategoryWhitelistService,
  ) {
    this.telegraf = new Telegraf(this.customConfigService.tgToken)
    this.bucketService = new BucketSharedService(this.bucketProvider.bucket, WishService.name)
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

  public async getList(
    id: string | number,
    filter: WishFilterDto,
    requestorUser?: TgInitUser,
  ): Promise<WishDocument[]> {
    const response = await this.wishEntity.findAll({ ...filter, userId: id?.toString() })

    if (requestorUser && requestorUser?.id?.toString() !== id && !!response.length) {
      const accessedWishlsit = await Promise.all(
        response?.map(async (wish) => {
          if (requestorUser && wish?.categoryId && requestorUser?.id?.toString() !== wish?.userId) {
            const filteredWish = await this.filterWishItem(wish, requestorUser)

            return filteredWish
          }

          return wish
        }),
      )

      const unemptyWishlist = accessedWishlsit?.filter(Boolean)

      if (response?.length && !unemptyWishlist.length) {
        const code = ERROR_CODES.wish.codes.WISH_PERMISSION_DENIED
        const message = ERROR_CODES.wish.messages[code]

        throw new ForbiddenException({ code, message })
      }

      return unemptyWishlist
    }

    return response
  }

  public async getItem(id: string, user?: TgInitUser): Promise<WishDocument> {
    const response = await this.wishEntity.get(id)

    this.validateNotFound(response)

    if (user && response?.categoryId && user?.id?.toString() !== response?.userId) {
      const filteredWish = await this.filterWishItem(response, user)

      if (!filteredWish) {
        const code = ERROR_CODES.wish.codes.WISH_PERMISSION_DENIED
        const message = ERROR_CODES.wish.messages[code]

        throw new ForbiddenException({ code, message })
      }
    }

    return response
  }

  private async filterWishItem(wish: WishDocument, requestorUser: TgInitUser) {
    const category = await this.categoryService.getItem(wish.categoryId)

    if (!category.isPrivate) {
      return wish
    }

    const whitelist = await this.categoryWhitelistService.findWhitelists({
      categoryId: category.id,
      whitelistedUserId: requestorUser?.id?.toString(),
      userId: category.userId,
    })

    if (!whitelist.length) {
      return undefined
    }

    return wish
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
      const updatedWish = { ...response, isBooked: false, bookedUserId: null }
      const payload = this.wishEntity.getValidProperties(updatedWish)
      await doc.update(payload)

      if (user.id?.toString() !== updatedWish.userId) {
        this.telegraf.telegram.sendMessage(
          updatedWish?.userId,
          `Ваше желание: ${updatedWish?.name || 'Без названия'}, больше не забронировано`,
          {
            reply_markup: {
              inline_keyboard: getOwnerWishItemKeyboard({
                id: updatedWish.id,
                wish: updatedWish,
                senderUserId: userId,
                webAppUrl: this.customConfigService.miniAppUrl,
              }),
            },
            parse_mode: 'HTML',
          },
        )
      }

      return payload
    }

    if (!response?.isBooked) {
      const updatedWish = { ...response, isBooked: true, bookedUserId: userId }
      const payload = this.wishEntity.getValidProperties(updatedWish)
      await doc.update(payload)

      if (user.id?.toString() !== updatedWish.userId) {
        this.telegraf.telegram.sendMessage(
          updatedWish?.userId,
          `Ваше желание: ${updatedWish?.name || 'Без названия'}, кто-то <b>Забронировал</b>`,
          {
            reply_markup: {
              inline_keyboard: getOwnerWishItemKeyboard({
                id: updatedWish.id,
                wish: updatedWish,
                senderUserId: userId,
                webAppUrl: this.customConfigService.miniAppUrl,
              }),
            },
            parse_mode: 'HTML',
          },
        )
      }

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

    try {
      await this.bucketService.deleteFileByName(wish?.imageUrl, `wish/${wish?.id}`)
    } catch (error) {
      this.logger.error(error)
    }

    await this.wishEntity.delete(id)

    return { success: true }
  }

  public async updateImage(user: TgInitUser, wishId: string, file: Express.Multer.File): Promise<WishDocument> {
    const { doc, data } = await this.wishEntity.getUpdate(wishId)

    if (!data) {
      throw new NotFoundException('Wish not found')
    }

    if (data.userId !== user?.id?.toString()) {
      const code = ERROR_CODES.wish.codes.WISH_PERMISSION_DENIED
      const message = ERROR_CODES.wish.messages[code]

      throw new ForbiddenException({
        code,
        message,
      })
    }

    const relativePath = await this.bucketService.saveFileByUrl(file?.originalname, `wish/${data?.id}`, file.buffer)

    try {
      await this.bucketService.deleteFileByName(data?.imageUrl, `wish/${data?.id}`)
    } catch (error) {
      this.logger.error(error)
    }

    const payload = this.wishEntity.getValidProperties({ ...data, imageUrl: relativePath })
    await doc.update(payload)

    return payload
  }

  public async removeImage(user: TgInitUser, wishId: string): Promise<WishDocument> {
    const { doc, data } = await this.wishEntity.getUpdate(wishId)

    if (!data) {
      throw new NotFoundException('User not found')
    }

    if (data.userId !== user?.id?.toString()) {
      const code = ERROR_CODES.wish.codes.WISH_PERMISSION_DENIED
      const message = ERROR_CODES.wish.messages[code]

      throw new ForbiddenException({
        code,
        message,
      })
    }

    try {
      await this.bucketService.deleteFileByName(data?.imageUrl, `wish/${data?.id}`)
    } catch (error) {
      this.logger.error(error)
    }

    doc.update({ imageUrl: null })

    return { ...data, imageUrl: null }
  }

  public async create(user: TgInitUser, body: WishPatchDto): Promise<WishDocument> {
    const payload = this.wishEntity.getValidProperties({ name: '', ...body, userId: user?.id?.toString() })

    return this.wishEntity.createOrUpdate(payload)
  }

  public async createAndNotifySubscribers(user: TgInitUser, body: WishPatchDto): Promise<WishDocument> {
    const [wish, subscribers] = await Promise.all([
      this.create(user, body),
      this.favoriteService.getSubscribersList(user?.id),
    ])

    this.notifyAllSubscribers(user, subscribers, wish)

    return wish
  }

  private async notifyAllSubscribers(owner: TgInitUser, subscribers: FavoriteDocument[], wish: WishDocument) {
    const subscribersWithNotifyEnabled = subscribers?.filter((subscriber) => subscriber?.wishlistNotifyEnabled)

    if (!subscribersWithNotifyEnabled?.length) return

    for await (const subscriber of subscribersWithNotifyEnabled) {
      const subscribedUser = await this.userEntity.get(subscriber?.userId)

      if (!subscribedUser) continue

      await this.telegraf.telegram.sendMessage(
        subscribedUser?.chatId,
        `Пользователь @${owner?.username || owner?.id}, добавил новое желание, можете посмотреть его в Web App`,
        {
          reply_markup: {
            inline_keyboard: getWishFavoriteKeyboard({
              id: subscriber.id,
              wishlistNotifyEnabled: subscriber?.wishlistNotifyEnabled,
              webAppUrl: `${this.customConfigService.miniAppUrl}/wish/${wish?.id}`,
            }),
          },
          parse_mode: 'HTML',
        },
      )
    }
  }
}
