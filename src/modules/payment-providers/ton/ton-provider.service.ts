import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { isNil } from 'lodash'

import { CustomConfigService } from '../../config'
import { IPaymentProviderService } from '../payment-provider.interfaces'
import { TonWeb, TonWebType } from './tonweb'

@Injectable()
export class TonProviderService implements IPaymentProviderService {
  private readonly logger = new Logger(TonProviderService.name)
  private readonly tonweb: TonWebType
  private readonly depositAddress: string
  private readonly withdrawAddress: string
  private readonly tonCenterApiKey: string

  constructor(
    private readonly customConfigService: CustomConfigService,
    private readonly configService: ConfigService,
  ) {
    this.tonCenterApiKey = this.configService.get<string>('TON_CENTER_API_KEY')

    if (this.customConfigService.testnetEnabled) {
      this.tonweb = new TonWeb(
        new TonWeb.HttpProvider('https://testnet.toncenter.com/api/v2/jsonRPC', {
          apiKey: this.tonCenterApiKey,
        }),
      )
    } else {
      this.tonweb = new TonWeb(
        new TonWeb.HttpProvider('https://toncenter.com/api/v2/jsonRPC', {
          apiKey: this.tonCenterApiKey,
        }),
      )
    }

    this.depositAddress = this.configService.get('TON_DEPOSIT_ADDRESS')
    this.withdrawAddress = this.configService.get('TON_WITHDRAW_ADDRESS')
  }

  public async healthcheck() {
    const balance = await this.tonweb.getBalance(this.depositAddress)

    if (isNil(balance)) {
      return false
    }

    return true
  }

  public async getBalance(address: string) {
    const balance = await this.tonweb.getBalance(address)

    if (isNil(balance)) {
      return { amount: '0', currency: 'TON' }
    }

    const ton = this.tonweb.utils.fromNano(balance)

    return { amount: ton, currency: 'TON' }
  }
}
