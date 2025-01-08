import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { UserContext } from 'src/decorator'
import {
  TransactionBalanceItem,
  TransactionBalanceTopup,
  TransactionBalanceTopupResponse,
  TransactionResponse,
} from 'src/entities'
import { TgDataGuard } from 'src/guards'
import { TgInitUser } from 'src/types'

import { TransactionService } from './transaction.service'

@Controller('v1/transaction')
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  @UseGuards(TgDataGuard)
  @Get('/list')
  async list(@UserContext() user: TgInitUser): Promise<TransactionResponse[]> {
    const transactions = await this.transactionService.getList(user?.id)

    return transactions.map((transaction) => this.transactionService.transform(transaction))
  }

  @UseGuards(TgDataGuard)
  @Get('/balance')
  async balance(@UserContext() user: TgInitUser): Promise<TransactionBalanceItem[]> {
    const balances = await this.transactionService.balance(user)

    return balances
  }

  @UseGuards(TgDataGuard)
  @Post('/balance/topup')
  async topup(
    @UserContext() user: TgInitUser,
    @Body() body: TransactionBalanceTopup,
  ): Promise<TransactionBalanceTopupResponse> {
    const response = await this.transactionService.balanceTopup(user, body)

    return response
  }

  @UseGuards(TgDataGuard)
  @Get('/:id')
  async item(@UserContext() user: TgInitUser, @Param() params: { id: string }): Promise<TransactionResponse> {
    const transaction = await this.transactionService.getItem(user, params?.id)

    return this.transactionService.transform(transaction)
  }

  @UseGuards(TgDataGuard)
  @Get('/:id/can-refund')
  async canRefund(@Param() params: { id: string }): Promise<TransactionResponse> {
    const transaction = await this.transactionService.canRefund(params?.id)

    return this.transactionService.transform(transaction)
  }

  @UseGuards(TgDataGuard)
  @Patch('/:id/refund')
  async refund(@UserContext() user: TgInitUser, @Param() params: { id: string }): Promise<TransactionResponse> {
    const transaction = await this.transactionService.refund(user, params?.id)

    return this.transactionService.transform(transaction)
  }
}