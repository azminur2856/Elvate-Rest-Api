import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { OcrService } from './ocr.service';
import { extname } from 'path';
import { Public } from 'src/auth/decorators/public.decorator';

//@Public()
@Controller('ocr')
export class OcrController {
  constructor(private readonly ocrService: OcrService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded.');
    }

    const extension = extname(file.originalname).toLowerCase();

    if (extension === '.pdf') {
      return this.ocrService.extractTextFromPdf(file.buffer);
    } else if (
      extension === '.jpg' ||
      extension === '.jpeg' ||
      extension === '.png' ||
      extension === '.heic'
    ) {
      return this.ocrService.extractTextFromImage(file.buffer);
    } else {
      throw new BadRequestException('Unsupported file type.');
    }
  }
}
