import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { CRON_JOBS, QUEUES } from '../../common/constants/queue.constants';
import { LoggerService } from '../../shared/logger/logger.service';
import { SessionsRepository } from '../auth/sessions/sessions.repository';

@Processor(QUEUES.CRON)
export class CronProcessor extends WorkerHost {
  constructor(
    private readonly sessionsRepository: SessionsRepository,
    private readonly logger: LoggerService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== CRON_JOBS.CLEANUP_EXPIRED_SESSIONS) {
      this.logger.warn(`Unhandled cron job: ${job.name}`, CronProcessor.name);
      return;
    }

    const result = await this.sessionsRepository.revokeExpired();
    this.logger.log(
      {
        job: job.name,
        revokedCount: result.count,
      },
      CronProcessor.name,
    );
  }
}
