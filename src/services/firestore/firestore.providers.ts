import { UserDocument, WishDocument } from 'src/entities'

export const FirestoreDatabaseProvider = 'firestoredb'
export const FirestoreOptionsProvider = 'firestoreOptions'
export const FirestoreCollectionProviders: string[] = [UserDocument.collectionName, WishDocument.collectionName]
