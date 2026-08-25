import { Controller, Delete, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../../common/types/jwt-payload.type';
import { SessionsService } from './sessions.service';

@Controller('auth/sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.sessionsService.getSessions(user.sub, user.sessionId);
  }

  @Delete('others')
  async revokeOthers(@CurrentUser() user: JwtPayload) {
    await this.sessionsService.revokeOthers(user.sub, user.sessionId);
    return { message: 'Other sessions revoked' };
  }

  @Delete(':id')
  async revokeOne(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    await this.sessionsService.revokeSession(id, user.sub);
    return { message: 'Session revoked' };
  }

  @Delete()
  async revokeAll(@CurrentUser() user: JwtPayload) {
    await this.sessionsService.revokeAll(user.sub);
    return { message: 'All sessions revoked' };
  }
}
