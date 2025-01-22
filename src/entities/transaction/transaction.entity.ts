import { CollectionReference, Timestamp } from '@google-cloud/firestore'
import { Inject, Injectable, Logger } from '@nestjs/common'
import firebase from 'firebase-admin'
import { getUniqueId, jsonParse, time } from 'src/helpers'
import { PaginationResponse } from 'src/types'

import { TransactionPayload, TransactionResponse } from './transaction.api.types'
import { TransactionDocument } from './transaction.document'
import { TransactionFilter, TransactionStatus } from './transaction.types'

@Injectable()
export class TransactionEntity {
  private logger: Logger = new Logger(TransactionEntity.name)

  constructor(
    @Inject(TransactionDocument.collectionName)
    private collection: CollectionReference<TransactionDocument>,
  ) {}

  async get(id: string): Promise<TransactionDocument | null> {
    const snapshot = await this.collection.doc(id).get()

    if (!snapshot.exists) {
      return null
    } else {
      return snapshot.data()
    }
  }

  async createOrUpdate(payload: TransactionDocument) {
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

  private findAllGenerator(filter: TransactionFilter) {
    const collectionRef = this.collection
    let query: firebase.firestore.Query<TransactionDocument> = collectionRef

    if (filter?.userId) {
      query = query.where('userId', '==', filter?.userId)
    }

    if (filter?.gameId) {
      query = query.where('gameId', '==', filter?.gameId)
    }

    if (filter?.type && !filter?.types?.length) {
      query = query.where('type', '==', filter?.type)
    }

    if (filter?.types?.length) {
      query = query.where('type', 'in', filter?.types)
    }

    if (filter?.id) {
      query = query.where('id', '==', filter?.id)
    }

    if (filter?.wishId) {
      query = query.where('wishId', '==', filter?.wishId)
    }

    if (filter?.status) {
      query = query.where('status', '==', filter?.status)
    }

    if (filter?.santaGameId) {
      query = query.where('santaGameId', '==', filter?.santaGameId)
    }

    return query
  }

  async findAll(filter: TransactionFilter, withOrderBy = true): Promise<TransactionDocument[]> {
    const list: TransactionDocument[] = []
    let query = this.findAllGenerator(filter)

    if (withOrderBy || filter?.createdAt) {
      query = query.orderBy('createdAt', 'desc')
    }

    if (filter?.limit) {
      query = query.limit(filter?.limit)
    }

    const snapshot = await query.get()
    snapshot.forEach((doc) => list.push(doc.data()))

    return list
  }

  async findAllWithPagination(
    filter: TransactionFilter,
    withOrderBy = true,
  ): Promise<PaginationResponse<TransactionDocument>> {
    const list: TransactionDocument[] = []
    let query = this.findAllGenerator(filter)

    if (withOrderBy) {
      query = query.orderBy('createdAt', 'desc')
    }

    const totalSnapshot = await query.count().get()
    const total = totalSnapshot.data().count

    if (filter?.createdAt) {
      query = query.startAfter(Timestamp.fromDate(time(filter?.createdAt).toDate()))
    }

    if (filter?.limit) {
      query = query.limit(filter?.limit)
    }

    const snapshot = await query.get()
    snapshot.forEach((doc) => list.push(doc.data()))

    return { list, total }
  }

  getValidProperties(document: { id?: string } & Omit<TransactionDocument, 'id'>, isUpdate?: boolean, logKey?: string) {
    const dueDateMillis = time().valueOf()
    const createdAt = Timestamp.fromMillis(dueDateMillis)

    if (document.payload) {
      const payload = jsonParse<TransactionPayload>(document.payload)

      if (!payload?.type || !payload.message) {
        this.logger.warn(`Invalid payload: ${document.payload} logKey=${logKey}`, {
          document,
          payload,
          logKey,
        })
      }
    }

    return {
      id: document.id || getUniqueId(),
      userId: document.userId,
      type: document.type,
      amount: document.amount,
      currency: document.currency,
      comissionPercent: document.comissionPercent || null,
      comissionAmount: document.comissionAmount || null,
      comissionCurrency: document.comissionCurrency || null,
      provider: document.provider || null,
      blockchain: document.blockchain || null,
      providerInvoiceId: document.providerInvoiceId || null,
      parentTransactionId: document.parentTransactionId || null,
      childrenTransactionId: document.childrenTransactionId || null,
      santaGameId: document.santaGameId || null,
      status: document.status || TransactionStatus.CREATED,
      gameId: document.gameId || null,
      payload: document.payload || null,
      wishId: document.wishId || null,
      refundExpiredAt: document.refundExpiredAt || null,
      refundedAt: document.refundedAt || null,
      expiredAt: document.expiredAt || null,
      createdAt: document.createdAt || createdAt,
      updatedAt: isUpdate ? createdAt : document.updatedAt || null,
    }
  }

  transform(transaction: TransactionDocument): TransactionResponse {
    const { createdAt, updatedAt, refundedAt, refundExpiredAt, expiredAt, ...rest } = transaction

    return {
      ...rest,
      createdAt: createdAt?.toDate().toISOString(),
      updatedAt: updatedAt?.toDate().toISOString(),
      refundedAt: refundedAt?.toDate().toISOString(),
      refundExpiredAt: refundExpiredAt?.toDate().toISOString(),
      expiredAt: expiredAt?.toDate().toISOString(),
    }
  }
}
