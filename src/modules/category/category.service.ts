import { Injectable, Logger } from '@nestjs/common'
import { CategroyEntity, WishDocument } from 'src/entities'
import { TgInitUser } from 'src/types'

import { CategoryDto } from './dto'

@Injectable()
export class CategoryService {
  private readonly logger = new Logger(CategoryService.name)

  constructor(private readonly categroyEntity: CategroyEntity) {}

  public async getList(id: string | number): Promise<WishDocument[]> {
    const response = await this.categroyEntity.findAll({ userId: id?.toString() })

    return response
  }

  public async getItem(id: string): Promise<WishDocument> {
    const response = await this.categroyEntity.get(id)

    return response
  }

  public async create(user: TgInitUser, body: CategoryDto): Promise<WishDocument> {
    const payload = this.categroyEntity.getValidProperties({ name: '', ...body, userId: user?.id?.toString() })

    return this.categroyEntity.createOrUpdate(payload)
  }
}