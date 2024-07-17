import { CollectionReference, Timestamp } from '@google-cloud/firestore'
import { Inject, Injectable, Logger } from '@nestjs/common'
import firebase from 'firebase-admin'
import { getUniqueId, time } from 'src/helpers'

import { CategoryWhitelistDocument } from './category-whitelist.document'
import { CategoryWhitelistFilter } from './category-whitelist.types'

@Injectable()
export class CategoryWhitelistEntity {
  private logger: Logger = new Logger(CategoryWhitelistEntity.name)

  constructor(
    @Inject(CategoryWhitelistDocument.collectionName)
    private collection: CollectionReference<CategoryWhitelistDocument>,
  ) {}

  async get(id: string): Promise<CategoryWhitelistDocument | null> {
    const snapshot = await this.collection.doc(id).get()

    if (!snapshot.exists) {
      return null
    } else {
      return snapshot.data()
    }
  }

  async createOrUpdate(payload: CategoryWhitelistDocument) {
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

  private findAllGenerator(filter: CategoryWhitelistFilter) {
    const collectionRef = this.collection
    let query: firebase.firestore.Query<CategoryWhitelistDocument> = collectionRef

    if (filter?.userId) {
      query = query.where('userId', '==', filter?.userId)
    }

    if (filter?.categoryId) {
      query = query.where('categoryId', '==', filter?.categoryId)
    }

    if (filter?.whitelistedUserId) {
      query = query.where('whitelistedUserId', '==', filter?.whitelistedUserId)
    }

    return query
  }

  async findAll(filter: CategoryWhitelistFilter): Promise<CategoryWhitelistDocument[]> {
    const list: CategoryWhitelistDocument[] = []
    let query = this.findAllGenerator(filter)

    query = query.orderBy('createdAt', 'desc')

    const snapshot = await query.get()
    snapshot.forEach((doc) => list.push(doc.data()))

    return list
  }

  getValidProperties(document: { id?: string } & Omit<CategoryWhitelistDocument, 'id'>) {
    const dueDateMillis = time().valueOf()
    const createdAt = Timestamp.fromMillis(dueDateMillis)

    return {
      id: document.id || getUniqueId(),
      userId: document.userId,
      whitelistedUserId: document.whitelistedUserId,
      categoryId: document.categoryId,
      createdAt: document.createdAt || createdAt,
      updatedAt: document.updatedAt || null,
    }
  }
}
