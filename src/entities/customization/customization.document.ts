import { Timestamp } from '@google-cloud/firestore'

/**
 * В моделях сущностей не может быть undefined полей, это ограничение firestore, разрешен только null или значения
 */
export class CustomizationDocument {
  static collectionName = 'customization'

  id: string
  userId: string
  patternName?: string
  title?: string
  createdAt?: Timestamp | null
  updatedAt?: Timestamp | null
}
