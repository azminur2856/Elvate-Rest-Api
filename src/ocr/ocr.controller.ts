import { ApiTags } from '@nestjs/swagger';
import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Req,
  Body,
} from '@nestjs/common';
import { OcrService } from './ocr.service';
import { ResizeImageDto, parseEditOptions } from './dto/edit-image.dto';
import { extname } from 'path';
import type { AuthRequest } from 'src/common/auth-user';
import { SingleFileUpload } from 'src/common/upload';

@ApiTags('Digital tools')
@Controller('ocr')
export class OcrController {
  constructor(private readonly ocrService: OcrService) {}

  @Post('upload/pdf')
  @UseInterceptors(SingleFileUpload('file'))
  async uploadPdf(@UploadedFile() file: Express.Multer.File, @Req() req) {
    if (!file) {
      throw new BadRequestException('No file uploaded.');
    }

    const extension = extname(file.originalname).toLowerCase();
    if (extension !== '.pdf') {
      throw new BadRequestException('Only PDF files are allowed.');
    }

    return this.ocrService.extractTextFromPdf(file.buffer, req.user.id);
  }

  @Post('upload/image')
  @UseInterceptors(SingleFileUpload('file'))
  async uploadImage(@UploadedFile() file: Express.Multer.File, @Req() req) {
    if (!file) {
      throw new BadRequestException('No file uploaded.');
    }

    const extension = extname(file.originalname).toLowerCase();
    if (
      extension !== '.jpg' &&
      extension !== '.jpeg' &&
      extension !== '.png' &&
      extension !== '.heic'
    ) {
      throw new BadRequestException('Only image files are allowed.');
    }

    return this.ocrService.extractTextFromImage(file.buffer, req.user.id);
  }

  @Post('image/resize')
  @UseInterceptors(SingleFileUpload('file'))
  async resizeImage(
    @UploadedFile() file: Express.Multer.File,
    @Req() req,
    @Body() body: ResizeImageDto,
  ) {
    if (!file) throw new BadRequestException('No file uploaded.');
    const extension = extname(file.originalname).toLowerCase();
    if (
      extension !== '.jpg' &&
      extension !== '.jpeg' &&
      extension !== '.png' &&
      extension !== '.heic'
    ) {
      throw new BadRequestException('Only image files are allowed.');
    }

    return this.ocrService.resizeImage(
      file.buffer,
      body.width,
      body.height,
      file.mimetype,
      req.user.id,
    );
  }

  /** BE-21. Multipart field `file`: JPG / PNG / WebP / HEIC up to 10 MB. */
  @Post('image/remove-bg')
  @UseInterceptors(SingleFileUpload('file'))
  async removeBackground(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthRequest,
  ) {
    if (!file) throw new BadRequestException('No file uploaded.');
    const extension = extname(file.originalname).toLowerCase();
    if (!['.jpg', '.jpeg', '.png', '.webp', '.heic'].includes(extension)) {
      throw new BadRequestException(
        'Only JPG, PNG, WebP or HEIC images are allowed.',
      );
    }
    return this.ocrService.removeBackground(file, req.user.id);
  }

  @Post('image/edit')
  @UseInterceptors(SingleFileUpload('file'))
  async editImage(
    @UploadedFile() file: Express.Multer.File,
    @Body('options') options: string, // should be JSON string
    @Req() req,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    const opts = parseEditOptions(options);
    const editedBuffer = await this.ocrService.editImage(
      file.buffer,
      opts,
      req.user.id,
    );

    // Return as base64 PNG
    return {
      contentType: 'image/png',
      data: editedBuffer.toString('base64'),
    };
  }
}
