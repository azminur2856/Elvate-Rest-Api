import { Controller, Post, Body } from '@nestjs/common';
import { ChatbotService } from './chatbot.service';
import { NoJwtBlacklistGuard } from 'src/auth/custom_decoretors/no_jwt_blacklist.decorator';

@Controller('chatbot')
export class ChatbotController {
  constructor(private readonly chatbotService: ChatbotService) {}

  @NoJwtBlacklistGuard()
  @Post('message')
  async handleMessage(@Body('message') message: string) {
    const response = await this.chatbotService.processMessage(message);
    return { response };
  }
}
