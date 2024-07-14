import { Module } from '@nestjs/common'
import { CustomizationEntity } from 'src/entities'

import { CustomizationController } from './customization.controller'
import { CustomizationService } from './customization.service'

@Module({
  imports: [],
  controllers: [CustomizationController],
  providers: [CustomizationEntity, CustomizationService],
  exports: [CustomizationEntity],
})
export class CustomizationModule {}
