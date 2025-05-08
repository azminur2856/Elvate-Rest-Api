import { Module } from '@nestjs/common';
import { ChatbotService } from './chatbot.service';
import { GeminiService } from './gemini.service';
import { ChatbotController } from './chatbot.controller';

@Module({
  controllers: [ChatbotController],
  providers: [ChatbotService, GeminiService],
})
export class ChatbotModule {}
