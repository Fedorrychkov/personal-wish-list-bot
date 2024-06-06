import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import * as admin from 'firebase-admin'

import { AppModule } from './app.module'

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  const configService: ConfigService = app.get(ConfigService)
  const projectId = configService.get<string>('FIREBASE_PROJECT_ID')
  // Set the config options
  const adminConfig: admin.ServiceAccount = {
    projectId,
    privateKey: configService.get<string>('FIREBASE_PRIVATE_KEY'),
    clientEmail: configService.get<string>('FIREBASE_CLIENT_EMAIL'),
  }

  admin.initializeApp({
    credential: admin.credential.cert(adminConfig),
    databaseURL: `https://${projectId}.firebaseio.com`,
  })

  await app.listen(8080)
}

bootstrap()
