import { CollectionReference, Timestamp } from '@google-cloud/firestore'
import { Inject, Injectable, Logger } from '@nestjs/common'
import firebase from 'firebase-admin'
import { time } from 'src/helpers'

import { FileDocument } from './file.document'

@Injectable()
export class FileEntity {
  private logger: Logger = new Logger(FileEntity.name)

  constructor(
    @Inject(FileDocument.collectionName)
    private collection: CollectionReference<FileDocument>,
  ) {}

  async get(id: string): Promise<FileDocument | null> {
    const snapshot = await this.collection.doc(id).get()

    if (!snapshot.exists) {
      return null
    } else {
      return snapshot.data()
    }
  }

  async createOrUpdate(user: FileDocument) {
    const document = await this.collection.doc(user.id)
    await document.set(user)

    return user
  }

  private findAllGenerator() {
    const collectionRef = this.collection
    const query: firebase.firestore.Query<FileDocument> = collectionRef

    return query
  }

  async getUpdate(id: string) {
    const doc = await this.collection.doc(id)
    const snapshot = await doc.get()

    if (!snapshot.exists) {
      return { doc: null, data: null }
    } else {
      return { doc, data: snapshot.data() }
    }
  }

  async findAll(): Promise<FileDocument[]> {
    const list: FileDocument[] = []
    let query = this.findAllGenerator()

    query = query.orderBy('createdAt', 'desc')

    const snapshot = await query.get()
    snapshot.forEach((doc) => list.push(doc.data()))

    return list
  }

  getValidProperties(file: FileDocument) {
    const dueDateMillis = time().valueOf()
    const createdAt = Timestamp.fromMillis(dueDateMillis)

    return {
      id: file.id,
      aliasUrl: file.aliasUrl,
      originalUrl: file.originalUrl,
      fileName: file.fileName || null,
      type: file.type,
      createdAt: file.createdAt || createdAt,
      updatedAt: file.updatedAt || null,
    }
  }
}
