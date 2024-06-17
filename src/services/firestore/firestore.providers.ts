import { UserDocument, WishDocument } from 'src/entities'
import { FileDocument } from 'src/entities/file'

export const FirestoreDatabaseProvider = 'firestoredb'
export const FirestoreOptionsProvider = 'firestoreOptions'
export const FirestoreCollectionProviders: string[] = [
  UserDocument.collectionName,
  WishDocument.collectionName,
  FileDocument.collectionName,
]
