import { Injectable, NotFoundException } from '@nestjs/common'
import { UserDocument, UserEntity } from 'src/entities'
import { TgInitUser } from 'src/types'

@Injectable()
export class UserService {
  constructor(private userEntity: UserEntity) {}

  public async getUser(user: TgInitUser): Promise<UserDocument> {
    const { id } = user || {}

    if (!user || !id) {
      throw new NotFoundException('User not found')
    }

    const response = await this.userEntity.get(id?.toString())

    return response
  }
}
