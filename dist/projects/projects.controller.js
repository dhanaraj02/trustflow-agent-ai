"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectsController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const prisma_service_1 = require("../prisma/prisma.service");
const draft_worker_1 = require("../draft/draft.worker");
const XLSX = __importStar(require("xlsx"));
let ProjectsController = class ProjectsController {
    prisma;
    draftWorker;
    constructor(prisma, draftWorker) {
        this.prisma = prisma;
        this.draftWorker = draftWorker;
    }
    async uploadQuestions(file) {
        if (!file) {
            throw new common_1.HttpException('No file uploaded', common_1.HttpStatus.BAD_REQUEST);
        }
        const workbook = XLSX.read(file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });
        if (!rows || rows.length <= 1) {
            throw new common_1.HttpException('No questions found in uploaded file', common_1.HttpStatus.BAD_REQUEST);
        }
        const project = await this.prisma.project.create({
            data: { name: `QA Upload ${new Date().toISOString()}` },
        });
        const questionItems = [];
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const question = String(row[0] ?? '').trim();
            if (!question)
                continue;
            const item = await this.prisma.questionItem.create({
                data: {
                    projectId: project.id,
                    question,
                    status: 'PENDING',
                },
            });
            questionItems.push(item);
        }
        await this.draftWorker.enqueueDraft(project.id);
        return { project, questionsCount: questionItems.length };
    }
    async getReviewData(id) {
        const projectId = Number(id);
        const project = await this.prisma.project.findUnique({
            where: { id: projectId },
            include: { questions: true },
        });
        if (!project) {
            throw new common_1.HttpException('Project not found', common_1.HttpStatus.NOT_FOUND);
        }
        return { projectId: project.id, questions: project.questions };
    }
    async updateQuestionStatus(id, status) {
        if (!['APPROVED', 'REJECTED'].includes(status)) {
            throw new common_1.HttpException('Invalid status', common_1.HttpStatus.BAD_REQUEST);
        }
        return this.prisma.questionItem.update({
            where: { id: Number(id) },
            data: { status },
        });
    }
    async exportProject(id, res) {
        const projectId = Number(id);
        const pendingCount = await this.prisma.questionItem.count({
            where: { projectId, status: 'NEEDS_REVIEW' },
        });
        if (pendingCount > 0) {
            throw new common_1.HttpException('There are items needing review', common_1.HttpStatus.CONFLICT);
        }
        const questions = await this.prisma.questionItem.findMany({
            where: { projectId },
            orderBy: { id: 'asc' },
        });
        const worksheetData = [
            ['Question', 'Answer', 'Status', 'Confidence', 'Citations'],
            ...questions.map((q) => [q.question, q.answer || '', q.status, q.confidence || 0, q.citations || '']),
        ];
        const workbook = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(worksheetData);
        XLSX.utils.book_append_sheet(workbook, ws, 'Export');
        const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="project-${projectId}-export.xlsx"`);
        res.send(buffer);
    }
};
exports.ProjectsController = ProjectsController;
__decorate([
    (0, common_1.Post)('upload'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    __param(0, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProjectsController.prototype, "uploadQuestions", null);
__decorate([
    (0, common_1.Get)(':id/review'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ProjectsController.prototype, "getReviewData", null);
__decorate([
    (0, common_1.Patch)('/questions/:id/status'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ProjectsController.prototype, "updateQuestionStatus", null);
__decorate([
    (0, common_1.Get)(':id/export'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ProjectsController.prototype, "exportProject", null);
exports.ProjectsController = ProjectsController = __decorate([
    (0, common_1.Controller)('projects'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        draft_worker_1.DraftWorker])
], ProjectsController);
//# sourceMappingURL=projects.controller.js.map