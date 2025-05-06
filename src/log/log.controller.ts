import {
  Controller,
  Get,
  UseGuards,
  Request,
  Res,
  ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LogService } from './log.service';
import { ProductLog } from './entities/product_logs.entity';

@Controller('logs')
export class LogController {
  constructor(
    private readonly logService: LogService,
    @InjectRepository(ProductLog)
    private readonly productLogRepository: Repository<ProductLog>,
  ) {}

  @Get('download')
  @UseGuards(AuthGuard('jwt'))
  async downloadPdf(@Request() req, @Res() res: Response) {
    if (req.user.role !== 'admin') {
      throw new ForbiddenException('Only admin can download logs');
    }

    const logs = await this.productLogRepository.find();
    const html = await this.logService.renderLogsHtml(logs, req.user);
    const pdfBuffer = await this.logService.generatePdf(html);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename=product-logs.pdf',
    });
    res.send(pdfBuffer);
  }
}
