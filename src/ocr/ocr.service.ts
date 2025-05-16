import { Injectable } from '@nestjs/common';
import * as pdfParse from 'pdf-parse';
import * as Tesseract from 'tesseract.js';

@Injectable()
export class OcrService {
  async extractTextFromPdf(buffer: Buffer): Promise<{ text: string }> {
    const data = await pdfParse(buffer);
    return { text: data.text.trim() };
  }

  async extractTextFromImage(buffer: Buffer): Promise<{ text: string }> {
    const result = await Tesseract.recognize(buffer, 'eng', {
      logger: (m) => console.log(m), // Optional progress log
    });
    return { text: result.data.text.trim() };
  }
}
