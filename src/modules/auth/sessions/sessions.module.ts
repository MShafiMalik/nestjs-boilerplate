import { Module } from '@nestjs/common';
import { DeviceParserService } from './device-parser.service';
import { SessionsController } from './sessions.controller';
import { SessionsRepository } from './sessions.repository';
import { SessionsService } from './sessions.service';

@Module({
  controllers: [SessionsController],
  providers: [SessionsRepository, SessionsService, DeviceParserService],
  exports: [SessionsService, SessionsRepository],
})
export class SessionsModule {}
