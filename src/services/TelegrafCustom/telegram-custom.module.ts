import { Module } from '@nestjs/common'
import { CustomConfigModule } from 'src/modules/config'

import { TelegrafCustomService } from './telegraf-custom.service'

@Module({
  imports: [CustomConfigModule],
  controllers: [],
  providers: [TelegrafCustomService],
  exports: [TelegrafCustomService],
})
export class TelegrafCustomModule {}
