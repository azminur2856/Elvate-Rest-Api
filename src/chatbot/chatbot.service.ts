import { Injectable } from '@nestjs/common';
import { GeminiService } from './gemini.service';

@Injectable()
export class ChatbotService {
  constructor(private readonly geminiService: GeminiService) {}

  async processMessage(message: string): Promise<string> {
    const aiResponse = await this.geminiService.askQuestion(message);
    return aiResponse;
  }
}
