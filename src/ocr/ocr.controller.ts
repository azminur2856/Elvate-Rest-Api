import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Req,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { EditOptions, OcrService } from './ocr.service';
import { extname } from 'path';
import { Public } from 'src/auth/decorators/public.decorator';

//@Public()
@Controller('ocr')
export class OcrController {
  constructor(private readonly ocrService: OcrService) {}

  @Post('upload/pdf')
  @UseInterceptors(FileInterceptor('file'))
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
  @UseInterceptors(FileInterceptor('file'))
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
  @UseInterceptors(FileInterceptor('file'))
  async resizeImage(
    @UploadedFile() file: Express.Multer.File,
    @Req() req,
    @Body() body: { width: string; height: string },
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

    // Parse/validate width/height
    const width = Number(body.width);
    const height = Number(body.height);

    if (
      !width ||
      !height ||
      width < 16 ||
      width > 4096 ||
      height < 16 ||
      height > 4096
    ) {
      throw new BadRequestException('Invalid width or height');
    }

    return this.ocrService.resizeImage(
      file.buffer,
      width,
      height,
      file.mimetype,
      req.user.id,
    );
  }

  // @Post('image/remove-bg')
  // @UseInterceptors(FileInterceptor('file'))
  // async removeBackground(
  //   @UploadedFile() file: Express.Multer.File,
  //   @Req() req: any,
  // ) {
  //   if (!file) {
  //     throw new BadRequestException('No file uploaded.');
  //   }

  //   const resultBuffer = await this.ocrService.removeBackground(
  //     file.buffer,
  //     file.mimetype,
  //     req.user.id,
  //   );

  //   return {
  //     contentType: 'image/png',
  //     data: resultBuffer.toString('base64'),
  //   };
  // }

  @Post('image/edit')
  @UseInterceptors(FileInterceptor('file'))
  async editImage(
    @UploadedFile() file: Express.Multer.File,
    @Body('options') options: string, // should be JSON string
    @Req() req,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    let opts: EditOptions;
    try {
      opts = JSON.parse(options);
    } catch {
      throw new BadRequestException('Invalid options format');
    }
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
