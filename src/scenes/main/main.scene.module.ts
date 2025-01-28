import { Module } from '@nestjs/common'
import { CategoryModule, CustomConfigModule, FileModule, TransactionModule, UserModule, WishModule } from 'src/modules'
import { CurrencyModule } from 'src/modules/currency'
import { GameModule } from 'src/modules/games'
import { SantaModule } from 'src/modules/games/santa'
import { WalletModule } from 'src/modules/wallet'
import { SharedSceneModule } from 'src/scenes/shared'

import { MainPaymentService } from './main.payment.service'
import { MainSceneService } from './main.scene.service'
import { MainSuperService } from './main.super.service'
import { MainWalletService } from './main.wallet.service'
import { MainWithdrawalService } from './main.withdrawal.service'
import { SendNewsSceneService } from './send-news'

@Module({
  imports: [
    UserModule,
    WishModule,
    SharedSceneModule,
    FileModule,
    CustomConfigModule,
    CategoryModule,
    GameModule,
    TransactionModule,
    WalletModule,
    SantaModule,
    CurrencyModule,
  ],
  controllers: [],
  providers: [
    MainSceneService,
    SendNewsSceneService,
    MainPaymentService,
    MainSuperService,
    MainWalletService,
    MainWithdrawalService,
  ],
  exports: [],
})
export class MainSceneModule {}
