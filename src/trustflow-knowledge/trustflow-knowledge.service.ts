import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AwsIntegrationService } from '../aws-integration/aws-integration.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TrustFlowKnowledgeService {
  private readonly logger = new Logger(TrustFlowKnowledgeService.name);

  constructor(
    private readonly awsIntegrationService: AwsIntegrationService,
    private readonly prisma: PrismaService,
  ) {}

  private toVectorLiteral(embedding: number[]) {
    return `[${embedding.join(',')}]`;
  }

  async ingestPdfToKnowledgeBase(projectId: number, buffer: Buffer, source = 'upload') {
    const parsed = await this.awsIntegrationService.parseDocumentWithTextract(buffer);
    const text = parsed.text;
    if (!text?.trim()) {
      throw new Error('No text found via Textract');
    }

    const chunks: string[] = [];
    const chunkSize = 1000;
    const overlap = 200;

    for (let start = 0; start < text.length; start += chunkSize - overlap) {
      const chunk = text.slice(start, Math.min(start + chunkSize, text.length));
      chunks.push(chunk);
      if (start + chunkSize >= text.length) break;
    }

    const results = [];

    for (const chunk of chunks) {
      const embedding = await this.awsIntegrationService.generateEmbeddings(chunk);

      // use raw SQL to insert vector(1536)
      const vectorExpression = `vector('${this.toVectorLiteral(embedding)}')`;
      await this.prisma.$executeRaw`
        INSERT INTO "Embedding" ("projectId", "chunk", "vector", "source", "createdAt")
        VALUES (${projectId}, ${chunk}, ${Prisma.raw(vectorExpression)}, ${source}, NOW())
      `;

      results.push({ chunk, source });
    }

    return {
      projectId,
      source,
      chunkCount: chunks.length,
      inserted: results.length,
    };
  }
}
