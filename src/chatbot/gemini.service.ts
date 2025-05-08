import { Injectable } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class GeminiService {
  private genAI: GoogleGenerativeAI;

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  }

  async askQuestion(prompt: string): Promise<string> {
    const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const systemInstruction = `You are a helpful assistant for the Elvate e-commerce website. You help users with ordering, returns, and product questions.If user ask how to,like these type of question, When giving step-by-step instructions, **do not** use Markdown or special formatting. 
Use plain text like:
1) Step one
2) Step two
3) Step three`;

    const fullPrompt = `${systemInstruction}\n\nUser: ${prompt}`;

    const result = await model.generateContent(fullPrompt);
    const response = result.response;

    return response.text().trim();
  }
}
