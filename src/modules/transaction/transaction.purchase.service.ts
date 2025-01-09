import { Timestamp } from '@google-cloud/firestore'
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import {
  TRANSACTION_BOOKED_USERS_XTR_AMOUNT,
  TRANSACTION_SANTA_GAME_XTR_STOPPED_AMOUNT,
  TRANSACTION_SANTA_GAME_XTR_UNSTOPPED_AMOUNT,
} from 'src/constants'
import {
  Purchase,
  PurchaseFilter,
  TransactionBalanceItem,
  TransactionDocument,
  TransactionEntity,
  TransactionPayload,
  TransactionProvider,
  TransactionStatus,
  TransactionType,
  WishEntity,
} from 'src/entities'
import { GameStatus } from 'src/entities/santa/santa.types'
import { ERROR_CODES } from 'src/errors'
import { jsonStringify, time } from 'src/helpers'
import { TgInitUser } from 'src/types'

import { GameService } from '../games'
import { GameType } from '../games/game.types'

@Injectable()
export class TransactionPurchaseService {
  private readonly logger = new Logger(TransactionPurchaseService.name)

  constructor(
    private readonly transactionEntity: TransactionEntity,
    private readonly wishEntity: WishEntity,
    private readonly gameService: GameService,
  ) {}

  async findWishPurchase(user: TgInitUser, filter: PurchaseFilter): Promise<TransactionDocument[]> {
    const { wishId } = filter
    const transactions = await this.transactionEntity.findAll(
      {
        userId: user?.id?.toString(),
        wishId,
        type: TransactionType.PURCHASE,
        status: TransactionStatus.CONFIRMED,
      },
      false,
    )

    return transactions
  }

  async findSecretSantaPurchase(user: TgInitUser, filter: PurchaseFilter): Promise<TransactionDocument[]> {
    const { santaGameId } = filter
    const transactions = await this.transactionEntity.findAll(
      {
        userId: user?.id?.toString(),
        santaGameId,
        type: TransactionType.PURCHASE,
        status: TransactionStatus.CONFIRMED,
      },
      false,
    )

    return transactions
  }

  async purchaseWish(
    user: TgInitUser,
    dto: Purchase,
    balanceByCurrency: TransactionBalanceItem,
    logKey?: string,
  ): Promise<TransactionDocument> {
    const { wishId, amount, currency, payload } = dto

    if (currency === 'XTR' && Number(balanceByCurrency?.amount) < TRANSACTION_BOOKED_USERS_XTR_AMOUNT) {
      throw new BadRequestException({
        code: ERROR_CODES.transaction.codes.TRANSACTION_NOT_ENOUGH_BALANCE,
        message: ERROR_CODES.transaction.messages.TRANSACTION_NOT_ENOUGH_BALANCE,
      })
    }

    if (!wishId) {
      throw new NotFoundException({
        code: ERROR_CODES.wish.codes.WISH_NOT_FOUND,
        message: ERROR_CODES.wish.codes.WISH_NOT_FOUND,
      })
    }

    const wish = await this.wishEntity.get(wishId)

    if (!wish) {
      throw new NotFoundException({
        code: ERROR_CODES.wish.codes.WISH_NOT_FOUND,
        message: ERROR_CODES.wish.codes.WISH_NOT_FOUND,
      })
    }

    try {
      const transactionPayload = this.transactionEntity.getValidProperties(
        {
          userId: user?.id?.toString(),
          type: TransactionType.PURCHASE,
          status: TransactionStatus.CONFIRMED,
          provider: TransactionProvider.INTERNAL,
          payload: jsonStringify<TransactionPayload>(payload),
          wishId,
          amount,
          currency,
          refundExpiredAt: Timestamp.fromDate(time().toDate()),
        },
        false,
        logKey,
      )

      const transaction = await this.transactionEntity.createOrUpdate(transactionPayload)

      return transaction
    } catch (error) {
      this.logger.error(`Error with purchase transaction logKey=${logKey}`, error, {
        userId: user?.id,
        amount: dto?.amount,
        currency: dto?.currency,
        logKey,
      })
    }
  }

  async purchaseSecretSanta(
    user: TgInitUser,
    dto: Purchase,
    balanceByCurrency: TransactionBalanceItem,
    logKey?: string,
  ): Promise<TransactionDocument> {
    const { santaGameId, amount, currency, payload } = dto

    /**
     * Minimal checking before get status of game
     */
    if (currency === 'XTR' && Number(balanceByCurrency?.amount) < TRANSACTION_SANTA_GAME_XTR_STOPPED_AMOUNT) {
      throw new BadRequestException({
        code: ERROR_CODES.transaction.codes.TRANSACTION_NOT_ENOUGH_BALANCE,
        message: ERROR_CODES.transaction.messages.TRANSACTION_NOT_ENOUGH_BALANCE,
      })
    }

    if (!santaGameId) {
      throw new NotFoundException({
        code: ERROR_CODES.game.codes.GAME_NOT_FOUND,
        message: ERROR_CODES.game.codes.GAME_NOT_FOUND,
      })
    }

    const game = await this.gameService.getGame(GameType.SANTA, santaGameId)

    if (!game) {
      throw new NotFoundException({
        code: ERROR_CODES.game.codes.GAME_NOT_FOUND,
        message: ERROR_CODES.game.codes.GAME_NOT_FOUND,
      })
    }

    const finalAmoount = [GameStatus.FINISHED, GameStatus.CANCELLED].includes(game?.status)
      ? TRANSACTION_SANTA_GAME_XTR_STOPPED_AMOUNT
      : TRANSACTION_SANTA_GAME_XTR_UNSTOPPED_AMOUNT

    if (currency === 'XTR' && Number(balanceByCurrency?.amount) < finalAmoount) {
      throw new BadRequestException({
        code: ERROR_CODES.transaction.codes.TRANSACTION_NOT_ENOUGH_BALANCE,
        message: ERROR_CODES.transaction.messages.TRANSACTION_NOT_ENOUGH_BALANCE,
      })
    }

    try {
      const transactionPayload = this.transactionEntity.getValidProperties(
        {
          userId: user?.id?.toString(),
          type: TransactionType.PURCHASE,
          status: TransactionStatus.CONFIRMED,
          provider: TransactionProvider.INTERNAL,
          payload: jsonStringify<TransactionPayload>(payload),
          santaGameId,
          amount,
          currency,
          refundExpiredAt: Timestamp.fromDate(time().toDate()),
        },
        false,
        logKey,
      )

      const transaction = await this.transactionEntity.createOrUpdate(transactionPayload)

      return transaction
    } catch (error) {
      this.logger.error(`Error with purchase transaction logKey=${logKey}`, error, {
        userId: user?.id,
        amount: dto?.amount,
        currency: dto?.currency,
        logKey,
      })
    }
  }
}
