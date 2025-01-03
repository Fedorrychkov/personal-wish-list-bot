import { CollectionReference, Timestamp } from '@google-cloud/firestore'
import { Inject, Injectable, Logger } from '@nestjs/common'
import firebase from 'firebase-admin'
import { getUniqueId, time } from 'src/helpers'

import { SantaDocument } from './santa.document'
import { GameStatus, SantaFilter } from './santa.types'

@Injectable()
export class SantaEntity {
  private logger: Logger = new Logger(SantaEntity.name)

  constructor(
    @Inject(SantaDocument.collectionName)
    private collection: CollectionReference<SantaDocument>,
  ) {}

  async get(id: string): Promise<SantaDocument | null> {
    const snapshot = await this.collection.doc(id).get()

    if (!snapshot.exists) {
      return null
    } else {
      return snapshot.data()
    }
  }

  async createOrUpdate(payload: SantaDocument) {
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

  private findAllGenerator(filter: SantaFilter) {
    const collectionRef = this.collection
    let query: firebase.firestore.Query<SantaDocument> = collectionRef

    if (filter?.userId) {
      query = query.where('userId', '==', filter?.userId)
    }

    if (filter?.id) {
      query = query.where('id', '==', filter?.id)
    }

    if (filter?.status) {
      query = query.where('status', '==', filter?.status)
    }

    if (filter?.statuses) {
      query = query.where('status', 'in', filter?.statuses)
    }

    return query
  }

  async findAll(filter: SantaFilter, withOrderBy = false): Promise<SantaDocument[]> {
    const list: SantaDocument[] = []
    let query = this.findAllGenerator(filter)

    if (withOrderBy) {
      query = query.orderBy('createdAt', 'desc')
    }

    const snapshot = await query.get()
    snapshot.forEach((doc) => list.push(doc.data()))

    return list
  }

  getValidProperties(document: { id?: string } & Omit<SantaDocument, 'id'>, updatedAt = false) {
    const dueDateMillis = time().valueOf()
    const createdAt = Timestamp.fromMillis(dueDateMillis)

    return {
      id: document.id || getUniqueId(),
      userId: document.userId,
      name: document.name || null,
      status: document.status || GameStatus.CREATED,
      createdAt: document.createdAt || createdAt,
      updatedAt: updatedAt ? createdAt : document.updatedAt || null,
    }
  }
}
