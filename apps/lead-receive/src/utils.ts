import { Injectable } from '@nestjs/common';
import { QuizMakerPayload } from './app.interfaces';
import { LeadMessage } from './app.interfaces';
import rawbody from 'raw-body';

@Injectable()
export class Utils {
  public safeJsonParse(text: string): unknown {
    return JSON.parse(text);
  }

  public isValidLeadMessage(data: unknown): data is LeadMessage {
    return (
      typeof data === 'object' &&
      data !== null &&
      'contact' in data &&
      typeof (data as LeadMessage).contact === 'object' &&
      'apiKey' in data &&
      typeof (data as LeadMessage).apiKey === 'string' &&
      'tagName' in data
    );
  }

  public isValidMessageType(data: unknown): data is LeadMessage | QuizMakerPayload {
    return (
      typeof data === 'object' &&
      data !== null &&
      (('contact' in data && typeof (data as LeadMessage).contact === 'object') ||
        ('app' in data && typeof (data as QuizMakerPayload).app === 'string'))
    );
  }

  public async getRawBody(request: NodeJS.ReadableStream): Promise<LeadMessage | QuizMakerPayload | undefined> {
    try {
      const raw = await rawbody(request);
      // Convert buffer to string and parse with safety checks
      const text = raw ? raw.toString().trim() : '';

      if (text) {
        try {
          const parsedData = this.safeJsonParse(text);
          if (this.isValidLeadMessage(parsedData)) {
            return parsedData;
          }

          if (this.isValidMessageType(parsedData)) {
            return parsedData;
          }
        } catch (parseError) {
          console.error('Error parsing JSON:', parseError);
        }
      }
    } catch (rawError) {
      console.error('Error reading request body:', rawError);
    }
  }

  public logInfo(dsc: string, args?: unknown): void {
    const logLevel = process.env.LOG_LEVEL || 'INFO';
    if (logLevel !== 'INFO' && logLevel !== 'DEBUG') {
      return;
    }
    console.log(dsc, typeof args === 'object' ? JSON.stringify(args) : args);
  }
}
