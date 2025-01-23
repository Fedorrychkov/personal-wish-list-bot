import { DynamicModule, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'

import { TonConnectService } from './ton-connect.connector'
import { TonConnectWallets } from './wallets'

@Module({
  imports: [ConfigModule],
  providers: [TonConnectService, TonConnectWallets],
  exports: [TonConnectService, TonConnectWallets],
})
export class TonConnectModule {
  static forRoot(): DynamicModule {
    return {
      global: true,
      imports: [ConfigModule],
      module: TonConnectModule,
      providers: [TonConnectService, TonConnectWallets],
      exports: [TonConnectService, TonConnectWallets],
    }
  }
}
