import { Module } from '@nestjs/common';
import { SessionsModule } from '../auth/sessions/sessions.module';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

@Module({
  imports: [SessionsModule],
  providers: [UsersRepository, UsersService],
  exports: [UsersService, UsersRepository],
})
export class UsersModule {}
