import { Injectable } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { EventPublisherService } from './event-publisher.service';

@Injectable()
export class AppService {
  constructor(private readonly eventPublisherService: EventPublisherService) {}

  async handleMessage(request: FastifyRequest, headers: any) {
    const message: any = {};
    const args: any = {};

    // Update message with request values and body
    message.timestamp = Date.now();

    // Get everything from the queryString and append to message
    const queryParams = request.query || {};
    // Merge all query parameters into the message object
    Object.keys(queryParams).forEach((key) => {
      message[key] = queryParams[key];
    });

    // Update args with query parameters
    Object.assign(args, request.query);

    const contentType = headers['content-type'] || '';

    if (contentType.includes('application/json')) {
      if (!request.body || Object.keys(request.body).length === 0) {
        return { statusCode: 422, response: 'Empty body' };
      }

      message.payload = request.body;
    }

    if (contentType.includes('application/x-www-form-urlencoded')) {
      if (!request.body || request.body === '') {
        return { statusCode: 422, response: 'Empty body' };
      }

      message.payload = Object.fromEntries(new URLSearchParams(request.body as string));
    }

    if (contentType.includes('text/plain')) {
      try {
        message.payload = JSON.parse(request.body as string);
      } catch (error) {
        console.error('Error parsing JSON:', error);
        return { statusCode: 422, response: 'Invalid JSON' };
      }
    }

    // Add client info
    const remoteIp = ((request.headers['x-forwarded-for'] as string) || request.ip || '').split(',')[0].trim();
    message.client_info = {
      EVENT_FAMILY: headers['user-agent'],
      EVENT_IP: remoteIp,
      userAgent: headers['user-agent'],
      ip: remoteIp,
    };

    // Rename keys in payload
    if (Array.isArray(message.payload)) {
      message.payload = message.payload.map((item: any) => this.renameKey(item, '-', '_'));
    }

    // Handle Twilio
    if (args.platform === 'twilio') {
      message.categories = args;
      if (message.payload) {
        message.payload.event = message.payload.MessageStatus;
      }

      args.platform = 'twilio';
      args.event = message.payload?.MessageStatus;
    }

    await this.eventPublisherService.publish(message, args);

    return { response: 'ok' };
  }

  private renameKey(obj: any, oldChar: string, newChar: string): any {
    const newObj: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const newKey = key.replace(oldChar, newChar);
      newObj[newKey] = value;
    }
    return newObj;
  }
}
