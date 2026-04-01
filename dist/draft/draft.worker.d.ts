import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AwsIntegrationService } from '../aws-integration/aws-integration.service';
import { PrismaService } from '../prisma/prisma.service';
export declare class DraftWorker implements OnModuleInit, OnModuleDestroy {
    private readonly prisma;
    private readonly awsIntegrationService;
    private readonly logger;
    private readonly queueName;
    private queue;
    private worker;
    constructor(prisma: PrismaService, awsIntegrationService: AwsIntegrationService);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    enqueueDraft(projectId: number, opts?: any): Promise<import("bullmq").Job<any, any, string>>;
    private fetchTopChunks;
    processDraftQuestions(projectId: number): Promise<{
        processed: number;
    }>;
}
