import { Module } from '@nestjs/common'
import { SantaEntity, SantaPlayerEntity, UserEntity } from 'src/entities'
import { CustomConfigModule } from 'src/modules/config'
import { TelegrafCustomModule } from 'src/services'

import { SantaService } from './santa.service'

@Module({
  imports: [TelegrafCustomModule, CustomConfigModule],
  controllers: [],
  providers: [SantaService, SantaEntity, SantaPlayerEntity, UserEntity],
  exports: [SantaService],
})
export class SantaModule {}
