import { CollectionReference, Timestamp } from '@google-cloud/firestore'
import { Inject, Injectable, Logger } from '@nestjs/common'
import firebase from 'firebase-admin'
import { getUniqueId, time } from 'src/helpers'

import { CustomizationDocument } from './customization.document'
import { CustomizationFilter } from './customization.types'

@Injectable()
export class CustomizationEntity {
  private logger: Logger = new Logger(CustomizationEntity.name)

  constructor(
    @Inject(CustomizationDocument.collectionName)
    private collection: CollectionReference<CustomizationDocument>,
  ) {}

  async get(id: string): Promise<CustomizationDocument | null> {
    const snapshot = await this.collection.doc(id).get()

    if (!snapshot.exists) {
      return null
    } else {
      return snapshot.data()
    }
  }

  async createOrUpdate(payload: CustomizationDocument) {
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

  private findAllGenerator(filter: CustomizationFilter) {
    const collectionRef = this.collection
    let query: firebase.firestore.Query<CustomizationDocument> = collectionRef

    if (filter?.userId) {
      query = query.where('userId', '==', filter?.userId)
    }

    return query
  }

  async findAll(filter: CustomizationFilter): Promise<CustomizationDocument[]> {
    const list: CustomizationDocument[] = []
    let query = this.findAllGenerator(filter)

    query = query.orderBy('createdAt', 'desc')

    const snapshot = await query.get()
    snapshot.forEach((doc) => list.push(doc.data()))

    return list
  }

  getValidProperties(document: { id?: string } & Omit<CustomizationDocument, 'id'>) {
    const dueDateMillis = time().valueOf()
    const createdAt = Timestamp.fromMillis(dueDateMillis)

    return {
      id: document.id || getUniqueId(),
      userId: document.userId,
      title: document?.title || null,
      patternName: document?.patternName || null,
      createdAt: document.createdAt || createdAt,
      updatedAt: document.updatedAt || null,
    }
  }
}
