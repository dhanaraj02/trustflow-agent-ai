import { Controller, Post, Get, Patch, Param, Body, UploadedFile, UseInterceptors, Res, HttpException, HttpStatus } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PrismaService } from '../prisma/prisma.service';
import { DraftWorker } from '../draft/draft.worker';
import * as XLSX from 'xlsx';
import type { Response } from 'express';

@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly draftWorker: DraftWorker,
  ) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadQuestions(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new HttpException('No file uploaded', HttpStatus.BAD_REQUEST);
    }

    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false }) as any[][];

    if (!rows || rows.length <= 1) {
      throw new HttpException('No questions found in uploaded file', HttpStatus.BAD_REQUEST);
    }

    const project = await this.prisma.project.create({
      data: { name: `QA Upload ${new Date().toISOString()}` },
    });

    const questionItems = [];

    // assume first row header has question column
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const question = String(row[0] ?? '').trim();
      if (!question) continue;

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

  @Get(':id/review')
  async getReviewData(@Param('id') id: string) {
    const projectId = Number(id);
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { questions: true },
    });

    if (!project) {
      throw new HttpException('Project not found', HttpStatus.NOT_FOUND);
    }

    return { projectId: project.id, questions: project.questions };
  }

  @Patch('/questions/:id/status')
  async updateQuestionStatus(@Param('id') id: string, @Body('status') status: 'APPROVED' | 'REJECTED') {
    if (!['APPROVED', 'REJECTED'].includes(status)) {
      throw new HttpException('Invalid status', HttpStatus.BAD_REQUEST);
    }

    return this.prisma.questionItem.update({
      where: { id: Number(id) },
      data: { status },
    });
  }

  @Get(':id/export')
  async exportProject(@Param('id') id: string, @Res() res: Response) {
    const projectId = Number(id);
    const pendingCount = await this.prisma.questionItem.count({
      where: { projectId, status: 'NEEDS_REVIEW' },
    });

    if (pendingCount > 0) {
      throw new HttpException('There are items needing review', HttpStatus.CONFLICT);
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
}
