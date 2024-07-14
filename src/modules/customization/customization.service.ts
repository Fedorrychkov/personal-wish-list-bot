import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { CustomizationDocument, CustomizationEntity } from 'src/entities'
import { TgInitUser } from 'src/types'

import { CustomizationDto } from './dto'

@Injectable()
export class CustomizationService {
  private readonly logger = new Logger(CustomizationService.name)

  constructor(private readonly customizationEntity: CustomizationEntity) {}

  public async getItemByUserId(userId: string): Promise<CustomizationDocument> {
    const [customization] = await this.customizationEntity.findAll({ userId })

    if (!customization) {
      throw new NotFoundException('Customization not found')
    }

    return customization
  }

  public async createOrUpdate(user: TgInitUser, body: CustomizationDto): Promise<CustomizationDocument> {
    if (!body.id) {
      const payload = this.customizationEntity.getValidProperties({ ...body, userId: user?.id?.toString() })

      return this.customizationEntity.createOrUpdate(payload)
    }

    const { doc, data } = await this.customizationEntity.getUpdate(body.id)
    const payload = this.customizationEntity.getValidProperties({ ...data, ...body })

    doc.update(payload)

    return payload
  }
}
