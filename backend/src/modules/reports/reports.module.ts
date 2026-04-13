import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { ExcelExportService } from './excel-export.service';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService, ExcelExportService],
  exports: [ReportsService],
})
export class ReportsModule {}
