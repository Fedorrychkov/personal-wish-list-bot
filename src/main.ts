import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { ExpressAdapter } from '@nestjs/platform-express'
import * as express from 'express'
import * as admin from 'firebase-admin'
import * as fs from 'fs'

import { AppModule } from './app.module'
import { isDevelop, isProduction } from './env'

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0'

const getCerts = () => {
  if (isProduction) {
    return {
      key: fs.readFileSync('./private.key'),
      cert: fs.readFileSync('./certificate.crt'),
    }
  }

  return {}
}

// На данный момент серты настроены только для Stage сервера
const httpsOptions = getCerts()

async function bootstrap() {
  const server = express()

  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), isDevelop ? undefined : { httpsOptions })

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
