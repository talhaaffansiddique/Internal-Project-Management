import { Controller, Get } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator.js';
import { ReportsService } from './reports.service.js';

/** Brief §18 — Management Reporting. Super Admin only, for now. */
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('overview')
  @Roles('SUPER_ADMIN')
  overview() {
    return this.reports.overview();
  }
}
