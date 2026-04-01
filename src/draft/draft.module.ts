import { Module } from '@nestjs/common';
import { DraftWorker } from './draft.worker';
import { AwsIntegrationModule } from '../aws-integration/aws-integration.module';

@Module({
  imports: [AwsIntegrationModule],
  providers: [DraftWorker],
  exports: [DraftWorker],
})
export class DraftModule {}
