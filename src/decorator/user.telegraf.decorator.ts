import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import { UserDocument } from 'src/entities'

/**
 * Use inside arg types
 */
export const UserTelegrafContext = createParamDecorator(
  async (_: unknown, ctx: ExecutionContext): Promise<UserDocument> => {
    const request = ctx.switchToHttp().getRequest()

    return request.userContext
  },
)
