import { AwsIntegrationService } from '../aws-integration/aws-integration.service';
import { PrismaService } from '../prisma/prisma.service';
export declare class TrustFlowKnowledgeService {
    private readonly awsIntegrationService;
    private readonly prisma;
    private readonly logger;
    constructor(awsIntegrationService: AwsIntegrationService, prisma: PrismaService);
    private toVectorLiteral;
    ingestPdfToKnowledgeBase(projectId: number, buffer: Buffer, source?: string): Promise<{
        projectId: number;
        source: string;
        chunkCount: number;
        inserted: number;
    }>;
}
