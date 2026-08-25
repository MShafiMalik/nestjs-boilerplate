import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../../../common/types/jwt-payload.type';
import { UsersRepository } from '../../users/users.repository';
import { UsersService } from '../../users/users.service';
import { SessionsService } from '../sessions/sessions.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private readonly usersRepository: UsersRepository,
    private readonly usersService: UsersService,
    private readonly sessionsService: SessionsService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('jwt.secret'),
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const user = await this.usersRepository.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Invalid token');
    }

    this.usersService.assertActive(user);
    await this.sessionsService.validateSession(payload.sessionId);

    return {
      sub: user.id,
      email: user.email,
      role: user.role,
      sessionId: payload.sessionId,
      isEmailVerified: user.isEmailVerified,
    };
  }
}
