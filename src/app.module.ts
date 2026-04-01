import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AwsIntegrationModule } from './aws-integration/aws-integration.module';
import { TrustFlowKnowledgeModule } from './trustflow-knowledge/trustflow-knowledge.module';
import { DraftModule } from './draft/draft.module';
import { ProjectsModule } from './projects/projects.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule, AwsIntegrationModule, TrustFlowKnowledgeModule, DraftModule, ProjectsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
