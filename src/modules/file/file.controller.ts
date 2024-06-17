import { Controller, Get, Param, Res } from '@nestjs/common'

import { FileService } from './file.service'

@Controller('v1/file')
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Get('/:id')
  async getFile(@Param() param: { id: string }, @Res({ passthrough: true }) res: Response) {
    const response = await this.fileService.getFile(param.id)

    response.data.pipe(res)

    return new Promise((resolve, reject) => {
      const r = res as any
      r?.on?.('finish', resolve)
      r?.on?.('error', reject)
    })
  }
}
