import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class CustomConfigService {
  public miniAppUrl: string
  public apiUrl: string

  constructor(
    @Inject(ConfigService)
    private configService: ConfigService,
  ) {
    this.miniAppUrl = this.configService.get<string>('MINI_APP_URL')
    this.apiUrl = this.configService.get<string>('API_URL')
  }
}
