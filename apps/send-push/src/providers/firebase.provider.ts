import { Injectable } from '@nestjs/common';
import { BatchResponse, TokenMessage } from 'firebase-admin/lib/messaging/messaging-api';
import * as admin from 'firebase-admin';
import { Utils } from '../utils/index.utils';
import { Messaging } from 'firebase-admin/lib/messaging/messaging';

@Injectable()
export class FirebaseProvider {
  private messaging: { [key: string]: Messaging } = {};

  constructor(private readonly utils: Utils) {
    if (process.env.NODE_ENV === 'test') {
      return;
    }
  }

  async initializeApp(firebaseServiceAccount, firebaseApp) {
    if (this.messaging && firebaseApp in this.messaging) {
      return;
    }
    let app;
    try {
      app = admin.initializeApp(
        {
          credential: admin.credential.cert(JSON.parse(firebaseServiceAccount || '{}')),
        },
        firebaseApp
      );
    } catch (_e) {
      app = admin.app(firebaseApp);
    }
    this.messaging[firebaseApp] = admin.messaging(app);
  }

  private async sendAll(messages: TokenMessage[], firebaseApp, dryRun?: boolean): Promise<BatchResponse> {
    if (process.env.NODE_ENV !== 'production') {
      for (const { notification, token } of messages) {
        console.log(`{ "aps": { "alert": ${JSON.stringify(notification)}, "token": "${token}" } }`);
      }
    }

    return this.messaging[firebaseApp].sendEach(messages, dryRun);
  }

  public async sendFirebaseMessages(
    firebaseMessages: TokenMessage[],
    firebaseServiceAccount: string,
    firebaseApp: string,
    dryRun?: boolean
  ): Promise<BatchResponse> {
    await this.initializeApp(firebaseServiceAccount, firebaseApp);
    const batchedFirebaseMessages = this.utils.breakArrayInChunks(firebaseMessages, 500);
    const batchResponses: BatchResponse[] = [];

    for await (const messages of batchedFirebaseMessages) {
      const response = await this.sendAll(messages, firebaseApp, dryRun);
      batchResponses.push(response);
    }

    return batchResponses.reduce(
      ({ responses, successCount, failureCount }, currentResponse) => {
        return {
          responses: responses.concat(currentResponse.responses),
          successCount: successCount + currentResponse.successCount,
          failureCount: failureCount + currentResponse.failureCount,
        };
      },
      {
        responses: [],
        successCount: 0,
        failureCount: 0,
      } as unknown as BatchResponse
    );
  }
}
