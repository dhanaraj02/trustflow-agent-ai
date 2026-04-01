import { Module } from '@nestjs/common';
import { AwsIntegrationService } from './aws-integration.service';

@Module({
  providers: [AwsIntegrationService],
  exports: [AwsIntegrationService],
})
export class AwsIntegrationModule {}
