import { Injectable } from '@nestjs/common'
import { CustomConfigService } from 'src/modules/config'
import { Telegraf } from 'telegraf'

@Injectable()
export class TelegrafCustomService {
  public telegraf: Telegraf

  constructor(private readonly customConfigService: CustomConfigService) {
    this.telegraf = new Telegraf(this.customConfigService.tgToken)
  }
}
