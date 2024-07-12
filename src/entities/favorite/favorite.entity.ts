import { CollectionReference, Timestamp } from '@google-cloud/firestore'
import { Inject, Injectable, Logger } from '@nestjs/common'
import firebase from 'firebase-admin'
import { getUniqueId, time } from 'src/helpers'

import { FavoriteDocument } from './favorite.document'
import { FavoriteFilter } from './favorite.types'

@Injectable()
export class FavoriteEntity {
  private logger: Logger = new Logger(FavoriteEntity.name)

  constructor(
    @Inject(FavoriteDocument.collectionName)
    private collection: CollectionReference<FavoriteDocument>,
  ) {}

  async get(id: string): Promise<FavoriteDocument | null> {
    const snapshot = await this.collection.doc(id).get()

    if (!snapshot.exists) {
      return null
    } else {
      return snapshot.data()
    }
  }

  async createOrUpdate(payload: FavoriteDocument) {
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

  private findAllGenerator(filter: FavoriteFilter) {
    const collectionRef = this.collection
    let query: firebase.firestore.Query<FavoriteDocument> = collectionRef

    if (filter?.userId) {
      query = query.where('userId', '==', filter?.userId)
    }

    if (filter?.favoriteUserId) {
      query = query.where('favoriteUserId', '==', filter?.favoriteUserId)
    }

    return query
  }

  async findAll(filter: FavoriteFilter): Promise<FavoriteDocument[]> {
    const list: FavoriteDocument[] = []
    let query = this.findAllGenerator(filter)

    query = query.orderBy('createdAt', 'desc')

    const snapshot = await query.get()
    snapshot.forEach((doc) => list.push(doc.data()))

    return list
  }

  getValidProperties(document: { id?: string } & Omit<FavoriteDocument, 'id'>) {
    const dueDateMillis = time().valueOf()
    const createdAt = Timestamp.fromMillis(dueDateMillis)

    return {
      id: document.id || getUniqueId(),
      userId: document.userId,
      favoriteUserId: document.favoriteUserId,
      wishlistNotifyEnabled: document.wishlistNotifyEnabled ?? true,
      createdAt: document.createdAt || createdAt,
      updatedAt: document.updatedAt || null,
    }
  }
}
