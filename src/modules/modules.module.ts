import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { QueuesModule } from './queues/queues.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [QueuesModule, UsersModule, AuthModule, HealthModule],
  exports: [QueuesModule, UsersModule, AuthModule, HealthModule],
})
export class ModulesModule {}
