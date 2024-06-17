import { Timestamp } from '@google-cloud/firestore'

import { FileTarget } from './file.types'

/**
 * В моделях сущностей не может быть undefined полей, это ограничение firestore, разрешен только null или значения
 */
export class FileDocument {
  static collectionName = 'file'

  id: string
  originalUrl: string
  aliasUrl: string
  type: FileTarget
  fileName?: string | null
  createdAt?: Timestamp | null
  updatedAt?: Timestamp | null
}
