import { Module } from '@nestjs/common'
import { FileEntity } from 'src/entities/file'

import { FileController } from './file.controller'
import { FileService } from './file.service'

@Module({
  imports: [],
  controllers: [FileController],
  providers: [FileEntity, FileService],
  exports: [FileEntity, FileService],
})
export class FileModule {}
