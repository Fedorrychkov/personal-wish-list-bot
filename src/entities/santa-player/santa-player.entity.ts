import { CollectionReference, Timestamp } from '@google-cloud/firestore'
import { Inject, Injectable, Logger } from '@nestjs/common'
import firebase from 'firebase-admin'
import { getUniqueId, time } from 'src/helpers'

import { SantaPlayerDocument } from './santa-player.document'
import { SantaPlayerFilter } from './santa-player.types'

@Injectable()
export class SantaPlayerEntity {
  private logger: Logger = new Logger(SantaPlayerEntity.name)

  constructor(
    @Inject(SantaPlayerDocument.collectionName)
    private collection: CollectionReference<SantaPlayerDocument>,
  ) {}

  async get(id: string): Promise<SantaPlayerDocument | null> {
    const snapshot = await this.collection.doc(id).get()

    if (!snapshot.exists) {
      return null
    } else {
      return snapshot.data()
    }
  }

  async createOrUpdate(payload: SantaPlayerDocument) {
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

  private findAllGenerator(filter: SantaPlayerFilter) {
    const collectionRef = this.collection
    let query: firebase.firestore.Query<SantaPlayerDocument> = collectionRef

    if (filter?.userId) {
      query = query.where('userId', '==', filter?.userId)
    }

    if (filter?.id) {
      query = query.where('id', '==', filter?.id)
    }

    if (filter?.santaGameId) {
      query = query.where('santaGameId', '==', filter?.santaGameId)
    }

    if (filter?.santaRecipientUserId) {
      query = query.where('santaRecipientUserId', '==', filter?.santaRecipientUserId)
    }

    if (filter?.isGameFinished) {
      query = query.where('isGameFinished', '==', filter?.isGameFinished)
    }

    if (filter?.isSantaConfirmed) {
      query = query.where('isSantaConfirmed', '==', filter?.isSantaConfirmed)
    }

    return query
  }

  async findAll(filter: SantaPlayerFilter, withOrderBy = false): Promise<SantaPlayerDocument[]> {
    const list: SantaPlayerDocument[] = []
    let query = this.findAllGenerator(filter)

    if (withOrderBy) {
      query = query.orderBy('createdAt', 'desc')
    }

    const snapshot = await query.get()
    snapshot.forEach((doc) => list.push(doc.data()))

    return list
  }

  getValidProperties(document: { id?: string } & Omit<SantaPlayerDocument, 'id'>, updatedAt = false) {
    const dueDateMillis = time().valueOf()
    const createdAt = Timestamp.fromMillis(dueDateMillis)

    return {
      id: document.id || getUniqueId(),
      userId: document.userId,
      santaGameId: document.santaGameId || null,
      santaRecipientUserId: document.santaRecipientUserId || null,
      isGameFinished: document.isGameFinished || false,
      isSantaConfirmed: document.isSantaConfirmed || false,
      createdAt: document.createdAt || createdAt,
      updatedAt: updatedAt ? createdAt : document.updatedAt || null,
    }
  }
}
