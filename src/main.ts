import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { ExpressAdapter } from '@nestjs/platform-express'
import * as express from 'express'
import * as admin from 'firebase-admin'

import { AppModule } from './app.module'

async function bootstrap() {
  const server = express()

  const app = await NestFactory.create(AppModule, new ExpressAdapter(server))

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
