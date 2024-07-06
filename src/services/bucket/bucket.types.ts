import { Bucket, Storage } from '@google-cloud/storage'

export type StorageProps = {
  projectId: string
  keyFilename: string
}

export type FirestoreModuleOptions = {
  imports: any[]
  useFactory: (...args: any[]) => StorageProps
  inject: any[]
}

export type BucketProvider = {
  bucket: Bucket
  storage: Storage
}
