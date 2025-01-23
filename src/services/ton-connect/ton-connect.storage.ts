import { Logger } from '@nestjs/common'
import { IStorage } from '@tonconnect/sdk'
import { createClient, RedisClientType } from 'redis'

let redisClient: RedisClientType

export class TonConnectStorage implements IStorage {
  private readonly logger = new Logger(TonConnectStorage.name)

  constructor(private readonly chatId: number, private readonly redisUrl: string) {
    if (!redisClient) {
      redisClient = createClient({ url: this.redisUrl })
      this.connect()
      redisClient.on('error', (err) => this.logger.error('Redis Client Error', err))
    }
  }

  onModuleInit() {
    if (!redisClient) {
      redisClient = createClient({ url: this.redisUrl })
      this.connect()
    }

    redisClient.on('error', (err) => this.logger.error('Redis Client Error', err))
  }

  private async connect(): Promise<void> {
    await redisClient.connect()
  }

  private getKey(key: string): string {
    return this.chatId.toString() + key
  }

  async removeItem(key: string): Promise<void> {
    await redisClient.del(this.getKey(key))
  }

  async setItem(key: string, value: string): Promise<void> {
    await redisClient.set(this.getKey(key), value)
  }

  async getItem(key: string): Promise<string | null> {
    return (await redisClient.get(this.getKey(key))) || null
  }
}
