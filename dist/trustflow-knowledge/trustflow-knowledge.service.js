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
var TrustFlowKnowledgeService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrustFlowKnowledgeService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const aws_integration_service_1 = require("../aws-integration/aws-integration.service");
const prisma_service_1 = require("../prisma/prisma.service");
let TrustFlowKnowledgeService = TrustFlowKnowledgeService_1 = class TrustFlowKnowledgeService {
    awsIntegrationService;
    prisma;
    logger = new common_1.Logger(TrustFlowKnowledgeService_1.name);
    constructor(awsIntegrationService, prisma) {
        this.awsIntegrationService = awsIntegrationService;
        this.prisma = prisma;
    }
    toVectorLiteral(embedding) {
        return `[${embedding.join(',')}]`;
    }
    async ingestPdfToKnowledgeBase(projectId, buffer, source = 'upload') {
        const parsed = await this.awsIntegrationService.parseDocumentWithTextract(buffer);
        const text = parsed.text;
        if (!text?.trim()) {
            throw new Error('No text found via Textract');
        }
        const chunks = [];
        const chunkSize = 1000;
        const overlap = 200;
        for (let start = 0; start < text.length; start += chunkSize - overlap) {
            const chunk = text.slice(start, Math.min(start + chunkSize, text.length));
            chunks.push(chunk);
            if (start + chunkSize >= text.length)
                break;
        }
        const results = [];
        for (const chunk of chunks) {
            const embedding = await this.awsIntegrationService.generateEmbeddings(chunk);
            const vectorExpression = `vector('${this.toVectorLiteral(embedding)}')`;
            await this.prisma.$executeRaw `
        INSERT INTO "Embedding" ("projectId", "chunk", "vector", "source", "createdAt")
        VALUES (${projectId}, ${chunk}, ${client_1.Prisma.raw(vectorExpression)}, ${source}, NOW())
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
};
exports.TrustFlowKnowledgeService = TrustFlowKnowledgeService;
exports.TrustFlowKnowledgeService = TrustFlowKnowledgeService = TrustFlowKnowledgeService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [aws_integration_service_1.AwsIntegrationService,
        prisma_service_1.PrismaService])
], TrustFlowKnowledgeService);
//# sourceMappingURL=trustflow-knowledge.service.js.map