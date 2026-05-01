import { Controller, Get, HttpCode } from '@nestjs/common'

@Controller('v1/healthcheck')
export class HealthcheckController {
  @Get('/')
  @HttpCode(200)
  healthcheck(): { success: boolean; isPrivate: boolean; message: string } {
    return { success: true, isPrivate: false, message: 'api CORE is available' }
  }
}
