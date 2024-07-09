import { CollectionReference, Timestamp } from '@google-cloud/firestore'
import { Inject, Injectable, Logger } from '@nestjs/common'
import firebase from 'firebase-admin'
import { getUniqueId, time } from 'src/helpers'

import { CategoryDocument } from './category.document'
import { CategoryFilter } from './category.types'

@Injectable()
export class CategroyEntity {
  private logger: Logger = new Logger(CategroyEntity.name)

  constructor(
    @Inject(CategoryDocument.collectionName)
    private collection: CollectionReference<CategoryDocument>,
  ) {}

  async get(id: string): Promise<CategoryDocument | null> {
    const snapshot = await this.collection.doc(id).get()

    if (!snapshot.exists) {
      return null
    } else {
      return snapshot.data()
    }
  }

  async createOrUpdate(payload: CategoryDocument) {
    const document = await this.collection.doc(payload.id)
    await document.set(payload)

    return payload
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

  async delete(id: string) {
    const document = await this.collection.doc(id)
    await document.delete()

    return true
  }

  private findAllGenerator() {
    const collectionRef = this.collection
    const query: firebase.firestore.Query<CategoryDocument> = collectionRef

    return query
  }

  async findAll(filter: CategoryFilter): Promise<CategoryDocument[]> {
    const list: CategoryDocument[] = []
    let query = this.findAllGenerator()

    query = query.orderBy('createdAt', 'desc')

    if (filter?.userId) {
      query = query.where('userId', '==', filter?.userId)
    }

    const snapshot = await query.get()
    snapshot.forEach((doc) => list.push(doc.data()))

    return list
  }

  getValidProperties(document: { id?: string } & Omit<CategoryDocument, 'id'>) {
    const dueDateMillis = time().valueOf()
    const createdAt = Timestamp.fromMillis(dueDateMillis)

    return {
      id: document.id || getUniqueId(),
      userId: document.userId,
      name: document.name || null,
      createdAt: document.createdAt || createdAt,
      updatedAt: document.updatedAt || null,
    }
  }
}
