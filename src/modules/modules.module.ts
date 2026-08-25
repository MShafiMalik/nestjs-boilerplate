import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { QueuesModule } from './queues/queues.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [QueuesModule, UsersModule, AuthModule],
  exports: [QueuesModule, UsersModule, AuthModule],
})
export class ModulesModule {}
