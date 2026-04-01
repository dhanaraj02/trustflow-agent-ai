import { Module } from '@nestjs/common';
import { TrustFlowKnowledgeService } from './trustflow-knowledge.service';
import { AwsIntegrationModule } from '../aws-integration/aws-integration.module';

@Module({
  imports: [AwsIntegrationModule],
  providers: [TrustFlowKnowledgeService],
  exports: [TrustFlowKnowledgeService],
})
export class TrustFlowKnowledgeModule {}
