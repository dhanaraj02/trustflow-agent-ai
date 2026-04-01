import { PrismaService } from '../prisma/prisma.service';
import { DraftWorker } from '../draft/draft.worker';
import type { Response } from 'express';
export declare class ProjectsController {
    private readonly prisma;
    private readonly draftWorker;
    constructor(prisma: PrismaService, draftWorker: DraftWorker);
    uploadQuestions(file: Express.Multer.File): Promise<{
        project: import("@prisma/client/runtime").GetResult<{
            id: number;
            name: string;
            description: string | null;
            createdAt: Date;
            updatedAt: Date;
        }, unknown> & {};
        questionsCount: number;
    }>;
    getReviewData(id: string): Promise<{
        projectId: number;
        questions: (import("@prisma/client/runtime").GetResult<{
            id: number;
            projectId: number;
            question: string;
            answer: string | null;
            status: string;
            confidence: number | null;
            citations: string | null;
            createdAt: Date;
            updatedAt: Date;
        }, unknown> & {})[];
    }>;
    updateQuestionStatus(id: string, status: 'APPROVED' | 'REJECTED'): Promise<import("@prisma/client/runtime").GetResult<{
        id: number;
        projectId: number;
        question: string;
        answer: string | null;
        status: string;
        confidence: number | null;
        citations: string | null;
        createdAt: Date;
        updatedAt: Date;
    }, unknown> & {}>;
    exportProject(id: string, res: Response): Promise<void>;
}
