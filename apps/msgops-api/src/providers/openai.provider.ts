import { OpenAI } from 'openai';

export class OpenAIProvider {
  private openAI;
  constructor() {
    this.openAI = new OpenAI({
      apiKey: process.env.OPEN_AI_KEY,
    });
  }

  async run(messages) {
    const completion = await this.openAI.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0,
      messages,
    });
    return completion.choices[0].message.content;
  }
}
