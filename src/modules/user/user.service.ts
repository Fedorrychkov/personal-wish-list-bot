import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { UserDocument, UserEntity } from 'src/entities'
import { ERROR_CODES } from 'src/errors'
import { BucketProvider, BucketSharedService, DefaultBucketProvider } from 'src/services'
import { TgInitUser } from 'src/types'

import { UserDto } from './dto'

@Injectable()
export class UserService {
  private bucketService: BucketSharedService
  private readonly logger = new Logger(UserService.name)

  constructor(
    private readonly userEntity: UserEntity,
    @Inject(DefaultBucketProvider.bucketName)
    private readonly bucketProvider: BucketProvider,
  ) {
    this.bucketService = new BucketSharedService(this.bucketProvider.bucket, UserService.name)
  }

  public async getUser(user: TgInitUser, params?: { id: string }): Promise<UserDocument> {
    const { id } = params || user || {}

    if (!user || !id) {
      throw new NotFoundException('User not found')
    }

    const response = await this.userEntity.get(id?.toString())

    return response
  }

  public async findUserByUsername(user: TgInitUser, username: string): Promise<UserDocument> {
    const { id } = user || {}

    const code = ERROR_CODES.user.codes.USER_NOT_FOUND
    const message = ERROR_CODES.wish.messages[code]

    if (!user || !id) {
      throw new NotFoundException({
        code,
        message,
      })
    }

    const [response] = await this.userEntity.findAll({ username })

    if (!response) {
      throw new NotFoundException({
        code,
        message,
      })
    }

    return response
  }

  public async updateAvatar(user: TgInitUser, file: Express.Multer.File): Promise<UserDocument> {
    const { doc, data } = await this.userEntity.getUpdate(user?.id?.toString())

    if (!data) {
      throw new NotFoundException('User not found')
    }

    const relativePath = await this.bucketService.saveFileByUrl(file?.originalname, `avatar/${data?.id}`, file.buffer)

    try {
      await this.bucketService.deleteFileByName(data?.avatarUrl, `avatar/${data?.id}`)
    } catch (error) {
      this.logger.error(error)
    }

    const payload = this.userEntity.getValidProperties({ ...data, avatarUrl: relativePath })
    await doc.update(payload)

    return payload
  }

  public async updateOnboarding(user: TgInitUser, dto: UserDto): Promise<UserDocument> {
    const { doc, data } = await this.userEntity.getUpdate(user?.id?.toString())

    if (!data) {
      throw new NotFoundException('User not found')
    }

    if (!dto.appOnboardingKey) {
      return data
    }

    const payload = this.userEntity.getValidProperties({ ...data, appOnboardingKey: dto.appOnboardingKey })
    await doc.update(payload)

    return payload
  }

  public async removeAvatar(user: TgInitUser): Promise<UserDocument> {
    const { doc, data } = await this.userEntity.getUpdate(user?.id?.toString())

    if (!data) {
      throw new NotFoundException('User not found')
    }

    try {
      await this.bucketService.deleteFileByName(data?.avatarUrl, `avatar/${data?.id}`)
    } catch (error) {
      this.logger.error(error)
    }

    doc.update({ avatarUrl: null })

    return { ...data, avatarUrl: null }
  }
}
