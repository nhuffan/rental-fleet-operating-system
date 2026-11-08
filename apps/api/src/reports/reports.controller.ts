import {
  Controller,
  Get,
  Inject,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import {
  AuthGuard,
  PermissionGuard,
  RequirePermission,
  TenantGuard,
  type AuthRequest,
} from '../auth/guards.js';
import { ReportExportParams, ReportQuery } from './dto.js';
import { ReportSummaryResponse } from './responses.js';
import { ReportsService } from './reports.service.js';

@ApiTags('Reports')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Business-Id', required: false })
@UseGuards(AuthGuard, TenantGuard, PermissionGuard)
@Controller('reports')
export class ReportsController {
  constructor(@Inject(ReportsService) private readonly reports: ReportsService) {}

  @Get('summary')
  @RequirePermission('report.read')
  @ApiOkResponse({ type: ReportSummaryResponse })
  @ApiOperation({
    description:
      'Recorded-movement revenue/expenses (exact VND), monthly series, rental counts and rented-time utilization for one window of at most 366 days.',
  })
  summary(@Req() r: AuthRequest, @Query() q: ReportQuery) {
    return this.reports.summary(r.tenant, q);
  }

  @Get('export/:kind')
  @RequirePermission('report.read')
  @ApiProduces('text/csv')
  @ApiOkResponse({ description: 'UTF-8 CSV (BOM), at most 10,000 rows.' })
  async export(
    @Req() r: AuthRequest,
    @Param() params: ReportExportParams,
    @Query() q: ReportQuery,
    @Res({ passthrough: true }) res: Response,
  ) {
    const csv = await this.reports.exportCsv(
      r.tenant,
      params.kind,
      q,
      r.requestId,
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${params.kind}.csv"`,
    );
    return csv;
  }
}
