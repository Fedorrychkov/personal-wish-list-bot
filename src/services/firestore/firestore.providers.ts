import {
  CategoryDocument,
  CategoryWhitelistDocument,
  CustomizationDocument,
  FavoriteDocument,
  FileDocument,
  SantaDocument,
  SantaPlayerDocument,
  TransactionDocument,
  UserDocument,
  WishDocument,
} from 'src/entities'

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
  TransactionDocument.collectionName,
]
