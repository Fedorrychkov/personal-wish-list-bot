import { CanActivate, ExecutionContext, ForbiddenException, Inject, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { createHmac } from 'crypto'
import { TgInitUser } from 'src/types'

export class TgDataGuard implements CanActivate {
  constructor(@Inject(Reflector) private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const request = context.switchToHttp().getRequest()
      const queryData = request.headers.Authorization || request.headers.authorization

      if (!queryData) throw new ForbiddenException('InitData is empty')

      const initData = new URLSearchParams(queryData)
      const hash = initData.get('hash')
      const dataToCheck: string[] = []

      initData.sort()
      initData.forEach((val, key) => key !== 'hash' && dataToCheck.push(`${key}=${val}`))

      const secret = createHmac('sha256', 'WebAppData').update(process.env.TELEGRAM_BOT_KEY).digest()

      const _hash = createHmac('sha256', secret).update(dataToCheck.join('\n')).digest('hex')

      const user: TgInitUser = JSON.parse(initData.get('user'))

      const checkData: TgInitUser = {
        ...user,
      }

      if (hash !== _hash) {
        throw new UnauthorizedException('Invalid data')
      }

      request.userContext = {
        ...checkData,
      }

      return true
    } catch (error) {
      throw new ForbiddenException('InitData is wrong')
    }
  }
}
