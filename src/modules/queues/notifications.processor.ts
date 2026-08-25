import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QUEUES, NOTIFICATION_JOBS } from '../../common/constants/queue.constants';
import { LoggerService } from '../../shared/logger/logger.service';

type WelcomeEmailJob = {
  userId: string;
  email: string;
  name: string;
};

type EmailVerificationJob = {
  email: string;
  name: string;
  verificationToken: string;
  verifyUrl: string;
};

type PasswordResetEmailJob = {
  email: string;
  name: string;
  resetToken: string;
  resetUrl: string;
};

@Processor(QUEUES.NOTIFICATIONS)
export class NotificationsProcessor extends WorkerHost {
  constructor(private readonly logger: LoggerService) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case NOTIFICATION_JOBS.WELCOME_EMAIL:
        this.logger.log(
          {
            job: job.name,
            ...(job.data as WelcomeEmailJob),
          },
          NotificationsProcessor.name,
        );
        break;
      case NOTIFICATION_JOBS.EMAIL_VERIFICATION:
        this.logger.log(
          {
            job: job.name,
            ...(job.data as EmailVerificationJob),
          },
          NotificationsProcessor.name,
        );
        break;
      case NOTIFICATION_JOBS.PASSWORD_RESET_EMAIL:
        this.logger.log(
          {
            job: job.name,
            ...(job.data as PasswordResetEmailJob),
          },
          NotificationsProcessor.name,
        );
        break;
      default:
        this.logger.warn(`Unhandled notification job: ${job.name}`, NotificationsProcessor.name);
    }
  }
}
