import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { ScheduleModule } from '@nestjs/schedule'
import { TelegrafModule } from 'nestjs-telegraf'
import * as LocalSession from 'telegraf-session-local'

import { isProduction } from './env'
import { UserModule } from './modules'
import { MainSceneModule, WishSceneModule } from './scenes'
import { FirestoreModule } from './services'

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
    MainSceneModule,
    WishSceneModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
