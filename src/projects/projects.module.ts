import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { DraftModule } from '../draft/draft.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, DraftModule],
  controllers: [ProjectsController],
})
export class ProjectsModule {}
