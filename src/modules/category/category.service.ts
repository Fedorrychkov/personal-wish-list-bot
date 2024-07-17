import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { CategoryDocument, CategroyEntity, WishEntity } from 'src/entities'
import { TgInitUser } from 'src/types'

import { CategoryDto } from './dto'

@Injectable()
export class CategoryService {
  private readonly logger = new Logger(CategoryService.name)

  constructor(private readonly categroyEntity: CategroyEntity, private readonly wishEntity: WishEntity) {}

  public async getList(id: string | number): Promise<CategoryDocument[]> {
    const response = await this.categroyEntity.findAll({ userId: id?.toString() })

    return response
  }

  public async getItem(id: string): Promise<CategoryDocument> {
    const response = await this.categroyEntity.get(id)

    return response
  }

  public async create(user: TgInitUser, body: CategoryDto): Promise<CategoryDocument> {
    const privateEnabled = typeof body.isPrivate === 'string' ? body.isPrivate === 'true' : body.isPrivate

    const payload = this.categroyEntity.getValidProperties({
      name: '',
      ...body,
      isPrivate: privateEnabled,
      userId: user?.id?.toString(),
    })

    return this.categroyEntity.createOrUpdate(payload)
  }

  public async update(user: TgInitUser, body: CategoryDto, id: string): Promise<CategoryDocument> {
    const privateEnabled = typeof body.isPrivate === 'string' ? body.isPrivate === 'true' : body.isPrivate
    const { data, doc } = await this.categroyEntity.getUpdate(id)

    if (user?.id?.toString() !== data?.userId) {
      throw new ForbiddenException('You cannot update different user category')
    }

    if (!data) {
      throw new NotFoundException('Category does not exist')
    }

    const payload = this.categroyEntity.getValidProperties({
      ...data,
      ...body,
      isPrivate: privateEnabled,
      userId: user?.id?.toString(),
    })

    await doc.update({ ...payload })

    return payload
  }

  public async delete(user: TgInitUser, id: string): Promise<{ success: boolean; id: string }> {
    const response = await this.categroyEntity.get(id)

    if (response && user?.id?.toString() !== response?.userId) {
      throw new ForbiddenException('You cannot delete different user category')
    }

    if (!response) {
      throw new NotFoundException('Category does not exist')
    }

    const wishlist = await this.wishEntity.findAll({ categoryId: response?.id, userId: user?.id?.toString() })

    await Promise.all(
      wishlist?.map(async (wish) => {
        const { doc, data } = await this.wishEntity.getUpdate(wish.id)

        if (data) {
          const payload = this.wishEntity.getValidProperties({ ...data, categoryId: null })

          await doc.update(payload)

          return payload
        }

        return undefined
      }),
    )

    await this.categroyEntity.delete(id)

    return { success: true, id }
  }
}
