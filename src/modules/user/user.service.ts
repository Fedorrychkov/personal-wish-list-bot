import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { UserDocument, UserEntity } from 'src/entities'
import { BucketProvider, BucketSharedService, DefaultBucketProvider } from 'src/services'
import { TgInitUser } from 'src/types'

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
