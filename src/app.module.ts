import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { ScheduleModule } from '@nestjs/schedule'
import * as cors from 'cors'
import { TelegrafModule } from 'nestjs-telegraf'
import * as LocalSession from 'telegraf-session-local'

import { isProduction } from './env'
import { CustomConfigModule, FileModule, UserModule } from './modules'
import { MainSceneModule, WishSceneModule } from './scenes'
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
    FileModule,
    CustomConfigModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(cors({ origin: true })).forRoutes(
      {
        path: 'v1/user',
        method: RequestMethod.ALL,
      },
      {
        path: 'v1/user/:id',
        method: RequestMethod.ALL,
      },
      {
        path: 'v1/user/avatar',
        method: RequestMethod.ALL,
      },
      {
        path: 'v1/wish',
        method: RequestMethod.ALL,
      },
      {
        path: 'v1/wish/list',
        method: RequestMethod.ALL,
      },
      {
        path: 'v1/wish/list/:id',
        method: RequestMethod.ALL,
      },
      {
        path: 'v1/wish/:id',
        method: RequestMethod.ALL,
      },
      {
        path: 'v1/wish/:id/image',
        method: RequestMethod.ALL,
      },
      {
        path: 'v1/wish/book/:id',
        method: RequestMethod.ALL,
      },
      {
        path: 'v1/file/:id',
        method: RequestMethod.ALL,
      },
    )
  }
}
