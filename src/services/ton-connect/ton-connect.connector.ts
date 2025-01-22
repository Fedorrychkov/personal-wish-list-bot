import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import TonConnect from '@tonconnect/sdk'
import { NodeEventDispatcher } from 'src/utils/event'

import { TonConnectStorage } from './ton-connect.storage'

type StoredConnectorData = {
  connector: TonConnect
  timeout: ReturnType<typeof setTimeout>
  onConnectorExpired: ((connector: TonConnect) => void)[]
}

@Injectable()
export class TonConnectService {
  private readonly connectors = new Map<number, StoredConnectorData>()
  private readonly manifestUrl: string
  private readonly connectorTtlMs: number

  constructor(private readonly configService: ConfigService) {
    this.manifestUrl = this.configService.get('MANIFEST_URL')
    this.connectorTtlMs = this.configService.get('CONNECTOR_TTL_MS')
  }

  public getConnector(chatId: number, onConnectorExpired?: (connector: TonConnect) => void): TonConnect {
    let storedItem: StoredConnectorData

    if (!this.configService.get('REDIS_URL')) {
      throw new Error('REDIS_URL is not set')
    }

    if (this.connectors.has(chatId)) {
      storedItem = this.connectors.get(chatId)
      clearTimeout(storedItem.timeout)
    } else {
      storedItem = {
        connector: new TonConnect({
          manifestUrl: this.manifestUrl,
          storage: new TonConnectStorage(chatId, this.configService.get('REDIS_URL')),
          eventDispatcher: new NodeEventDispatcher(),
        }),
        onConnectorExpired: [],
      } as unknown as StoredConnectorData
    }

    if (onConnectorExpired) {
      storedItem.onConnectorExpired.push(onConnectorExpired)
    }

    storedItem.timeout = setTimeout(() => {
      if (this.connectors.has(chatId)) {
        const storedItem = this.connectors.get(chatId)
        storedItem.connector.pauseConnection()
        storedItem.onConnectorExpired.forEach((callback) => callback(storedItem.connector))
        this.connectors.delete(chatId)
      }
    }, this.connectorTtlMs)

    this.connectors.set(chatId, storedItem)

    return storedItem.connector
  }
}
