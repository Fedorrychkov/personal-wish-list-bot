import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import axios, { AxiosInstance } from 'axios'
import { truncate } from 'src/helpers'
import { AnyCurrency } from 'src/types'

@Injectable()
export class CurrencyService {
  private readonly coingeckoApiKey: string
  private readonly coingeckoApiUrl = 'https://api.coingecko.com/api/v3/'
  private readonly coingeckoApiParams: Record<string, string>

  private readonly client: AxiosInstance
  private readonly RATES: Record<string, { rate: number; currency: AnyCurrency }> = {
    /**
     * 1 XTR = 0.012 USD
     */
    XTR_USD: {
      rate: 0.012,
      currency: 'USD',
    },
    TON_USD: {
      rate: undefined,
      currency: 'USD',
    },
    XTR_TON: {
      rate: undefined,
      currency: 'TON',
    },
  }

  private readonly CURRENCY_MAP: Record<string, string> = {
    TON: 'the-open-network',
    USD: 'usd',
  }

  constructor(
    @Inject(ConfigService)
    private configService: ConfigService,
  ) {
    this.coingeckoApiKey = this.configService.get<string>('COINGECKO_API_KEY')
    this.coingeckoApiParams = {
      x_cg_demo_api_key: this.coingeckoApiKey,
    }
    this.client = axios.create({
      baseURL: this.coingeckoApiUrl,
      params: this.coingeckoApiParams,
    })
  }

  public async getRate(from: AnyCurrency, to: AnyCurrency): Promise<number> {
    if (from === to) {
      return 1
    }

    const pair = `${from?.toUpperCase()}_${to?.toUpperCase()}`
    const rate = this.RATES[pair]

    if (rate.rate) {
      return rate.rate
    }

    const fromId = this.CURRENCY_MAP[from]
    const toId = this.CURRENCY_MAP[to]

    if (from === 'XTR' && to === 'TON') {
      const xtrUsdRate = this.RATES.XTR_USD.rate

      const response = await this.client.get('/simple/price', {
        params: {
          ids: this.CURRENCY_MAP['TON'],
          vs_currencies: this.CURRENCY_MAP['USD'],
        },
      })

      const tonUsdRate = response.data?.[this.CURRENCY_MAP['TON']]?.[this.CURRENCY_MAP['USD']] // 5.07 USD

      // Получаем курс XTR/TON
      const xtrTonRate = xtrUsdRate / tonUsdRate

      /**
       * Мы не сохраняем курс, так как он может меняться каждый запрос
       */
      return truncate(xtrTonRate, 6)
    }

    const response = await this.client.get('/simple/price', {
      params: {
        ids: fromId,
        vs_currencies: toId,
      },
    })

    return response.data?.[fromId]?.[toId]
  }
}
