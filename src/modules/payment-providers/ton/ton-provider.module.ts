import { Module } from '@nestjs/common'
import { CustomConfigModule } from 'src/modules/config'

import { TonProviderService } from './ton-provider.service'

@Module({
  imports: [CustomConfigModule],
  controllers: [],
  providers: [TonProviderService],
  exports: [TonProviderService],
})
export class TonProviderModule {}
