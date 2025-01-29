import { Module } from '@nestjs/common'

import { CurrencyService } from './currency.service'

@Module({
  imports: [],
  controllers: [],
  providers: [CurrencyService],
  exports: [CurrencyService],
})
export class CurrencyModule {}
