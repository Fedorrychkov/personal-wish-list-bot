import { MiddlewareConsumer, Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { ScheduleModule } from '@nestjs/schedule'
import * as cors from 'cors'
import { TelegrafModule } from 'nestjs-telegraf'
import * as LocalSession from 'telegraf-session-local'

import { isProduction } from './env'
import {
  CategoryModule,
  CategoryWhitelistModule,
  CustomConfigModule,
  CustomizationModule,
  FavoriteModule,
  FileModule,
  TransactionModule,
  UserModule,
} from './modules'
import { GameModule } from './modules/games'
import { MainSceneModule, WishSceneModule } from './scenes'
import { FavoriteSceneModule } from './scenes/favorite/favorite.scene.module'
import { GamesSceneModule } from './scenes/games/games.scene.module'
import { FirestoreModule } from './services'
import { BucketModule } from './services/bucket'

const session = new LocalSession()

@Module({
  imports: [
    UserModule,
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: isProduction ? '.env' : '.env.stage',
    }),
    FirestoreModule.forRoot({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        keyFilename: configService.get<string>('SA_KEY'),
      }),
      inject: [ConfigService],
    }),
    TelegrafModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        token: configService.get<string>('TELEGRAM_BOT_KEY'),
        launchOptions: {
          // webhook: {
          //   domain: 'domain.tld',
          //   path: '/secret-path',
          // },
        },
        middlewares: [session.middleware()],
      }),
      inject: [ConfigService],
    }),
    BucketModule.forRoot({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        projectId: configService.get<string>('FIREBASE_PROJECT_ID'),
        keyFilename: configService.get<string>('SA_KEY'),
      }),
      inject: [ConfigService],
    }),
    MainSceneModule,
    WishSceneModule,
    FavoriteSceneModule,
    FileModule,
    CustomConfigModule,
    CategoryModule,
    FavoriteModule,
    CustomizationModule,
    CategoryWhitelistModule,
    GameModule,
    GamesSceneModule,
    TransactionModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {
  constructor(private readonly configService: ConfigService) {}

  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(
        cors({
          origin: this.configService.get<string>('MINI_APP_URL'),
          credentials: true,
        }),
      )
      .forRoutes('*')
  }
}
