import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { CRON_JOBS, QUEUES } from '../../common/constants/queue.constants';
import { SessionsModule } from '../auth/sessions/sessions.module';
import { CronProcessor } from './cron.processor';
import { NotificationsProcessor } from './notifications.processor';

@Module({
  imports: [
    SessionsModule,
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const password = config.get<string>('redis.password');
        return {
          connection: {
            host: config.getOrThrow<string>('redis.host'),
            port: config.getOrThrow<number>('redis.port'),
            password: password ? password : undefined,
            maxRetriesPerRequest: null,
          },
        };
      },
    }),
    BullModule.registerQueue({ name: QUEUES.NOTIFICATIONS }, { name: QUEUES.CRON }),
  ],
  providers: [NotificationsProcessor, CronProcessor],
  exports: [BullModule],
})
export class QueuesModule implements OnModuleInit {
  constructor(@InjectQueue(QUEUES.CRON) private readonly cronQueue: Queue) {}

  async onModuleInit(): Promise<void> {
    await this.cronQueue.upsertJobScheduler(
      CRON_JOBS.CLEANUP_EXPIRED_SESSIONS,
      { pattern: '0 0 * * *' },
      {
        name: CRON_JOBS.CLEANUP_EXPIRED_SESSIONS,
        data: {},
        opts: {
          removeOnComplete: true,
          removeOnFail: 100,
        },
      },
    );
  }
}
