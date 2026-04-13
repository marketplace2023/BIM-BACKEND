import { Controller, Get, Query, Request, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { BimJwtGuard } from '../common/guards/bim-jwt.guard';
import { ReportesService } from './reportes.service';

@UseGuards(BimJwtGuard)
@Controller('reportes')
export class ReportesController {
  constructor(private readonly reportesService: ReportesService) {}

  @Get('pdf')
  async generatePdf(
    @Query('type') type: string,
    @Query('obraId') obraId: string,
    @Query('presupuestoId') presupuestoId: string | undefined,
    @Request() req: any,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.reportesService.generatePdf(
      type,
      req.user.tenant_id,
      obraId,
      presupuestoId,
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(buffer);
  }
}
