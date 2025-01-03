import {
  CategoryDocument,
  CategoryWhitelistDocument,
  CustomizationDocument,
  SantaDocument,
  SantaPlayerDocument,
  UserDocument,
  WishDocument,
} from 'src/entities'
import { FavoriteDocument } from 'src/entities/favorite'
import { FileDocument } from 'src/entities/file'

export const FirestoreDatabaseProvider = 'firestoredb'
export const FirestoreOptionsProvider = 'firestoreOptions'
export const FirestoreCollectionProviders: string[] = [
  UserDocument.collectionName,
  WishDocument.collectionName,
  FileDocument.collectionName,
  CategoryDocument.collectionName,
  FavoriteDocument.collectionName,
  CustomizationDocument.collectionName,
  CategoryWhitelistDocument.collectionName,
  SantaDocument.collectionName,
  SantaPlayerDocument.collectionName,
]
