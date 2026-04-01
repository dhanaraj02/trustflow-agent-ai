"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var DraftWorker_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DraftWorker = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("bullmq");
const aws_integration_service_1 = require("../aws-integration/aws-integration.service");
const prisma_service_1 = require("../prisma/prisma.service");
let DraftWorker = DraftWorker_1 = class DraftWorker {
    prisma;
    awsIntegrationService;
    logger = new common_1.Logger(DraftWorker_1.name);
    queueName = 'draft-questions';
    queue;
    worker;
    constructor(prisma, awsIntegrationService) {
        this.prisma = prisma;
        this.awsIntegrationService = awsIntegrationService;
        const connection = {
            host: process.env.REDIS_HOST || 'localhost',
            port: Number(process.env.REDIS_PORT || 6379),
        };
        this.queue = new bullmq_1.Queue(this.queueName, { connection });
        this.worker = new bullmq_1.Worker(this.queueName, async (job) => {
            const { projectId } = job.data;
            return this.processDraftQuestions(projectId);
        }, { connection });
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
    async enqueueDraft(projectId, opts) {
        return this.queue.add('process', { projectId }, opts ?? {});
    }
    async fetchTopChunks(projectId, embedding) {
        const vectorLiteral = `[${embedding.join(',')}]`;
        const rows = await this.prisma.$queryRaw `
        SELECT "id", "chunk", "source", (1.0 / (1.0 + ("vector" <=> vector('${vectorLiteral}')))) AS similarity
        FROM "Embedding"
        WHERE "projectId" = ${projectId}
        ORDER BY "vector" <=> vector('${vectorLiteral}')
        LIMIT 4;
      `;
        return rows;
    }
    async processDraftQuestions(projectId) {
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
            }
            catch (err) {
                this.logger.error(`Error processing question ${question.id}`, err);
            }
        }
        return { processed: pendingItems.length };
    }
};
exports.DraftWorker = DraftWorker;
exports.DraftWorker = DraftWorker = DraftWorker_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        aws_integration_service_1.AwsIntegrationService])
], DraftWorker);
//# sourceMappingURL=draft.worker.js.map