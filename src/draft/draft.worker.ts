import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Worker, Queue } from 'bullmq';
import { AwsIntegrationService } from '../aws-integration/aws-integration.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DraftWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DraftWorker.name);
  private readonly queueName = 'draft-questions';
  private queue: Queue;
  private worker: Worker;

  constructor(
    private readonly prisma: PrismaService,
    private readonly awsIntegrationService: AwsIntegrationService,
  ) {
    const connection = {
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT || 6379),
    };

    this.queue = new Queue(this.queueName, { connection });

    this.worker = new Worker(
      this.queueName,
      async (job) => {
        const { projectId } = job.data;
        return this.processDraftQuestions(projectId);
      },
      { connection },
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`Draft job completed for project ${job.data.projectId}`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Draft job failed for project ${job?.data?.projectId}`, err);
    });
  }

  async onModuleInit() {
    await this.queue.waitUntilReady();
    await this.worker.waitUntilReady();

    this.logger.log('DraftWorker initialized and ready');
  }

  async onModuleDestroy() {
    await this.worker.close();
    await this.queue.close();
  }

  async enqueueDraft(projectId: number, opts?: any) {
    return this.queue.add('process', { projectId }, opts ?? {});
  }

  private async fetchTopChunks(projectId: number, embedding: number[]) {
    const vectorLiteral = `[${embedding.join(',')}]`;
    const rows: Array<{ id: number; chunk: string; source: string | null; similarity: number }> =
      await this.prisma.$queryRaw`
        SELECT "id", "chunk", "source", (1.0 / (1.0 + ("vector" <=> vector('${vectorLiteral}')))) AS similarity
        FROM "Embedding"
        WHERE "projectId" = ${projectId}
        ORDER BY "vector" <=> vector('${vectorLiteral}')
        LIMIT 4;
      `;

    return rows;
  }

  public async processDraftQuestions(projectId: number) {
    const pendingItems = await this.prisma.questionItem.findMany({
      where: { projectId, status: 'PENDING' },
    });

    if (pendingItems.length === 0) {
      this.logger.log(`No pending questions for project ${projectId}`);
      return { processed: 0 };
    }

    for (const question of pendingItems) {
      try {
        const contextEmbeddings = await this.awsIntegrationService.generateEmbeddings(question.question);
        const topChunks = await this.fetchTopChunks(projectId, contextEmbeddings);

        const contextText = topChunks.map((c, i) => `Chunk ${i + 1} (score=${c.similarity.toFixed(4)}):\n${c.chunk}`).join('\n\n');

        const prompt = `You are a SOC 2 security analyst. Answer the question: ${question.question}\n\nContext:\n${contextText}\n\nProvide a concise answer with citations.`;

        const aiAnswer = await this.awsIntegrationService.generateDraftAnswer(prompt);

        const highestSimilarity = topChunks.length > 0 ? Math.max(...topChunks.map((c) => c.similarity)) : 0;
        const status = highestSimilarity < 0.65 ? 'NEEDS_REVIEW' : 'DRAFTED';

        await this.prisma.questionItem.update({
          where: { id: question.id },
          data: {
            answer: aiAnswer,
            confidence: highestSimilarity,
            status,
            citations: topChunks.map((c) => c.source ?? 'unknown').join('; '),
          },
        });
      } catch (err) {
        this.logger.error(`Error processing question ${question.id}`, err as Error);
      }
    }

    return { processed: pendingItems.length };
  }
}
