import { CollectionReference, Timestamp } from '@google-cloud/firestore'
import { Inject, Injectable, Logger } from '@nestjs/common'
import firebase from 'firebase-admin'
import { getUniqueId, time } from 'src/helpers'

import { WishDocument } from './wish.document'
import { WishFilter } from './wish.types'

@Injectable()
export class WishEntity {
  private logger: Logger = new Logger(WishEntity.name)

  constructor(
    @Inject(WishDocument.collectionName)
    private collection: CollectionReference<WishDocument>,
  ) {}

  async get(id: string): Promise<WishDocument | null> {
    const snapshot = await this.collection.doc(id).get()

    if (!snapshot.exists) {
      return null
    } else {
      return snapshot.data()
    }
  }

  async createOrUpdate(payload: WishDocument) {
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
    const query: firebase.firestore.Query<WishDocument> = collectionRef

    return query
  }

  async findAll(filter: WishFilter): Promise<WishDocument[]> {
    const list: WishDocument[] = []
    let query = this.findAllGenerator()

    query = query.orderBy('createdAt', 'desc')

    if (filter?.userId) {
      query = query.where('userId', '==', filter?.userId)
    }

    if (filter?.categoryId) {
      query = query.where('categoryId', '==', filter?.categoryId)
    }

    const snapshot = await query.get()
    snapshot.forEach((doc) => list.push(doc.data()))

    return list
  }

  getValidProperties(document: { id?: string } & Omit<WishDocument, 'id'>) {
    const dueDateMillis = time().valueOf()
    const createdAt = Timestamp.fromMillis(dueDateMillis)

    return {
      id: document.id || getUniqueId(),
      userId: document.userId,
      name: document.name || null,
      isBooked: document.isBooked || false,
      bookedUserId: document.bookedUserId || null,
      description: document.description || null,
      link: document.link || null,
      categoryId: document.categoryId || null,
      imageUrl: document.imageUrl || null,
      createdAt: document.createdAt || createdAt,
      updatedAt: document.updatedAt || null,
    }
  }
}
