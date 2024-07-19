import { CollectionReference, Timestamp } from '@google-cloud/firestore'
import { Inject, Injectable, Logger } from '@nestjs/common'
import firebase from 'firebase-admin'
import { time } from 'src/helpers'

import { UserDocument } from './user.document'
import { UserFilter } from './user.types'

@Injectable()
export class UserEntity {
  private logger: Logger = new Logger(UserEntity.name)

  constructor(
    @Inject(UserDocument.collectionName)
    private collection: CollectionReference<UserDocument>,
  ) {}

  async get(id: string): Promise<UserDocument | null> {
    const snapshot = await this.collection.doc(id).get()

    if (!snapshot.exists) {
      return null
    } else {
      return snapshot.data()
    }
  }

  async createOrUpdate(user: UserDocument) {
    const document = await this.collection.doc(user.id)
    await document.set(user)

    return user
  }

  private findAllGenerator(filter: UserFilter) {
    const collectionRef = this.collection
    let query: firebase.firestore.Query<UserDocument> = collectionRef

    if (filter?.username) {
      query = query.where('username', '==', filter.username)
    }

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

  async findAll(filter: UserFilter): Promise<UserDocument[]> {
    const list: UserDocument[] = []
    let query = this.findAllGenerator(filter)

    query = query.orderBy('createdAt', 'desc')

    const snapshot = await query.get()
    snapshot.forEach((doc) => list.push(doc.data()))

    return list
  }

  getValidProperties(user: UserDocument) {
    const dueDateMillis = time().valueOf()
    const createdAt = Timestamp.fromMillis(dueDateMillis)

    return {
      id: user.id,
      chatId: user.chatId,
      username: user.username || null,
      firstName: user.firstName || null,
      lastName: user.lastName || null,
      isPremium: user.isPremium || false,
      avatarUrl: user.avatarUrl || null,
      isBot: user.isBot || false,
      phone: user.phone || null,
      createdAt: user.createdAt || createdAt,
      updatedAt: user.updatedAt || null,
    }
  }
}
