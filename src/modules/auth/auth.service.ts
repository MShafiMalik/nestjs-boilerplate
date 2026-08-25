import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client/index.js';
import { APP_CONSTANTS } from '../../common/constants/app.constants';
import { NOTIFICATION_JOBS } from '../../common/constants/queue.constants';
import { JwtPayload, JwtRefreshPayload } from '../../common/types/jwt-payload.type';
import { UtilService } from '../../common/util/util.service';
import { LoggerService } from '../../shared/logger/logger.service';
import { SafeUser, UsersService } from '../users/users.service';
import { UsersRepository } from '../users/users.repository';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendEmailVerificationDto } from './dto/resend-email-verification.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { SessionsService } from './sessions/sessions.service';

export type AuthTokensResponse = {
  accessToken: string;
  refreshToken: string;
  user: SafeUser;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly usersRepository: UsersRepository,
    private readonly sessionsService: SessionsService,
    private readonly utilService: UtilService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {}

  async register(dto: RegisterDto): Promise<{ message: string }> {
    const existing = await this.usersRepository.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await this.utilService.hashPassword(dto.password);
    const user = await this.usersRepository.create({
      name: dto.name,
      email: dto.email,
      password: hashedPassword,
      role: Role.USER,
      isEmailVerified: false,
    });

    const verificationToken = this.utilService.generateRandomString(48);
    const expiresAt = this.utilService.addMinutes(new Date(), APP_CONSTANTS.EMAIL_VERIFICATION_EXPIRES_MINUTES);
    const sentAt = new Date();

    await this.usersRepository.setEmailVerification(
      user.id,
      this.utilService.sha256(verificationToken),
      expiresAt,
      sentAt,
    );

    this.enqueueEmailVerification(user.email, user.name, verificationToken);

    return { message: 'Check your email to verify your account' };
  }

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string): Promise<AuthTokensResponse> {
    const user = await this.usersService.findByEmailWithPassword(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    this.usersService.assertActive(user);
    this.usersService.assertEmailVerified(user);

    const passwordValid = await this.utilService.comparePassword(dto.password, user.password);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const session = await this.sessionsService.createSession(user.id, dto.deviceInfo, ipAddress, userAgent);

    return this.buildAuthResponse(user.id, session.id);
  }

  async refresh(payload: JwtRefreshPayload): Promise<AuthTokensResponse> {
    await this.sessionsService.touch(payload.sessionId);
    return this.buildAuthResponse(payload.sub, payload.sessionId);
  }

  async logout(user: JwtPayload): Promise<{ message: string }> {
    await this.sessionsService.revokeSession(user.sessionId, user.sub);
    return { message: 'Logged out' };
  }

  async getProfile(userId: string): Promise<SafeUser> {
    return this.usersService.findById(userId);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<SafeUser> {
    return this.usersService.update(userId, dto);
  }

  async deleteAccount(user: JwtPayload): Promise<{ message: string }> {
    await this.sessionsService.revokeAll(user.sub);
    await this.usersService.softDelete(user.sub, user.email);
    return { message: 'Account deleted' };
  }

  async changePassword(user: JwtPayload, dto: ChangePasswordDto): Promise<{ message: string }> {
    const existing = await this.usersService.findByEmailWithPassword(user.email);
    if (!existing) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await this.utilService.comparePassword(dto.currentPassword, existing.password);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const hashedPassword = await this.utilService.hashPassword(dto.newPassword);
    await this.usersService.updatePassword(user.sub, hashedPassword);
    await this.sessionsService.revokeOthers(user.sub, user.sessionId);

    return { message: 'Password changed' };
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const message = {
      message: 'If the email exists, a reset link was sent.',
    };

    const user = await this.usersRepository.findByEmail(dto.email);
    if (!user || !user.isActive) {
      return message;
    }

    const resetToken = this.utilService.generateRandomString(48);
    const expiresAt = this.utilService.addMinutes(new Date(), APP_CONSTANTS.PASSWORD_RESET_EXPIRES_MINUTES);

    await this.usersRepository.setPasswordReset(user.id, this.utilService.sha256(resetToken), expiresAt);

    const appUrl = this.configService.getOrThrow<string>('app.appUrl');
    const resetUrl = `${appUrl}/reset-password?token=${resetToken}`;

    this.logger.log(
      {
        job: NOTIFICATION_JOBS.PASSWORD_RESET_EMAIL,
        email: user.email,
        name: user.name,
        resetToken,
        resetUrl,
      },
      AuthService.name,
    );

    return message;
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const user = await this.usersService.findByPasswordResetHash(this.utilService.sha256(dto.token));

    if (!user || !user.isActive || this.utilService.isExpired(user.passwordResetExpires)) {
      throw new BadRequestException('Invalid or expired token');
    }

    const hashedPassword = await this.utilService.hashPassword(dto.newPassword);
    await this.usersService.updatePassword(user.id, hashedPassword);
    await this.sessionsService.revokeAll(user.id);

    return { message: 'Password reset successful. Please log in again.' };
  }

  async verifyEmail(dto: VerifyEmailDto, ipAddress?: string, userAgent?: string): Promise<AuthTokensResponse> {
    const user = await this.usersService.findByEmailVerificationHash(this.utilService.sha256(dto.token));

    if (!user || !user.isActive || user.isEmailVerified || this.utilService.isExpired(user.emailVerificationExpires)) {
      throw new BadRequestException('Invalid or expired token');
    }

    await this.usersService.clearEmailVerification(user.id);

    const session = await this.sessionsService.createSession(user.id, dto.deviceInfo, ipAddress, userAgent);

    this.logger.log(
      {
        job: NOTIFICATION_JOBS.WELCOME_EMAIL,
        userId: user.id,
        email: user.email,
        name: user.name,
      },
      AuthService.name,
    );

    return this.buildAuthResponse(user.id, session.id);
  }

  async resendEmailVerification(dto: ResendEmailVerificationDto): Promise<{ message: string }> {
    const message = {
      message: 'If the email exists, a verification link was sent.',
    };

    const user = await this.usersRepository.findByEmail(dto.email);
    if (!user || !user.isActive || user.isEmailVerified) {
      return message;
    }

    if (user.emailVerificationSentAt) {
      const cooldownEnds = this.utilService.addMinutes(
        user.emailVerificationSentAt,
        APP_CONSTANTS.EMAIL_VERIFICATION_COOLDOWN_MINUTES,
      );
      if (cooldownEnds.getTime() > Date.now()) {
        return message;
      }
    }

    const verificationToken = this.utilService.generateRandomString(48);
    const expiresAt = this.utilService.addMinutes(new Date(), APP_CONSTANTS.EMAIL_VERIFICATION_EXPIRES_MINUTES);
    const sentAt = new Date();

    await this.usersRepository.setEmailVerification(
      user.id,
      this.utilService.sha256(verificationToken),
      expiresAt,
      sentAt,
    );

    this.enqueueEmailVerification(user.email, user.name, verificationToken);

    return message;
  }

  private enqueueEmailVerification(email: string, name: string, verificationToken: string): void {
    const appUrl = this.configService.getOrThrow<string>('app.appUrl');
    const verifyUrl = `${appUrl}/verify-email?token=${verificationToken}`;

    this.logger.log(
      {
        job: NOTIFICATION_JOBS.EMAIL_VERIFICATION,
        email,
        name,
        verificationToken,
        verifyUrl,
      },
      AuthService.name,
    );
  }

  private async buildAuthResponse(userId: string, sessionId: string): Promise<AuthTokensResponse> {
    const user = await this.usersService.findById(userId);
    const accessPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      sessionId,
      isEmailVerified: user.isEmailVerified,
    };
    const refreshPayload: JwtRefreshPayload = {
      sub: user.id,
      sessionId,
    };

    const accessToken = await this.jwtService.signAsync(
      { ...accessPayload },
      {
        secret: this.configService.getOrThrow<string>('jwt.secret'),
        expiresIn: this.configService.getOrThrow('jwt.expiresIn'),
      },
    );

    const refreshToken = await this.jwtService.signAsync(
      { ...refreshPayload },
      {
        secret: this.configService.getOrThrow<string>('jwt.refreshSecret'),
        expiresIn: this.configService.getOrThrow('jwt.refreshExpiresIn'),
      },
    );

    return {
      accessToken,
      refreshToken,
      user,
    };
  }
}
