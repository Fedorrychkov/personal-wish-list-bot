import { Injectable } from '@nestjs/common'
import { FileDocument, FileEntity } from 'src/entities/file'
import { FileTarget } from 'src/entities/file'
import { getUniqueId } from 'src/helpers'
import { request } from 'src/utils/request'

@Injectable()
export class FileService {
  constructor(private fileEntity: FileEntity) {}

  public async getFile(id: string) {
    const response = await this.fileEntity.get(id)

    const fileResponse = await request({
      method: 'GET',
      url: response?.originalUrl,
      responseType: 'stream',
    })

    return fileResponse
  }

  public async createFile(url: string): Promise<FileDocument> {
    const id = getUniqueId()
    const file = this.fileEntity.getValidProperties({
      id,
      type: FileTarget.telegram,
      originalUrl: url,
      aliasUrl: `/v1/file/${id}`,
      fileName: '',
    })

    await this.fileEntity.createOrUpdate(file)

    return file
  }
}
