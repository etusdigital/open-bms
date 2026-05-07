import * as http from 'http';
import * as sendgrid from '@sendgrid/mail';
import { getSendGridClient } from './sendgrid-client.helper';

describe('SendGrid SDK redirect (EVO-1052 regression guard)', () => {
  let server: http.Server;
  let port: number;
  let received: { method: string; url: string }[] = [];

  beforeAll((done) => {
    server = http.createServer((req, res) => {
      received.push({ method: req.method, url: req.url });
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        res.writeHead(202, { 'content-type': 'application/json' });
        res.end('{}');
      });
    });
    server.listen(0, '127.0.0.1', () => {
      port = (server.address() as { port: number }).port;
      done();
    });
  });

  afterAll((done) => {
    // Reset the singleton's baseUrl so other Jest suites in the same worker
    // don't inherit the local-server URL we mutated above.
    getSendGridClient()?.setDefaultRequest('baseUrl', 'https://api.sendgrid.com/');
    server.close(() => done());
  });

  beforeEach(() => {
    received = [];
  });

  it('routes sgMail.send() to local mock when setDefaultRequest runs AFTER setApiKey', async () => {
    sendgrid.setApiKey('SG.test-key-EVO-1052');
    getSendGridClient()?.setDefaultRequest('baseUrl', `http://127.0.0.1:${port}`);

    const [response] = await sendgrid.send({
      to: 'a@a.com',
      from: 'b@b.com',
      subject: 's',
      text: 't',
    });

    expect(response.statusCode).toBe(202);
    expect(received).toHaveLength(1);
    expect(received[0]).toEqual({ method: 'POST', url: '/v3/mail/send' });
  });

  // Pins the SDK quirk this PR works around. If a future @sendgrid/client
  // release stops resetting defaultRequest.baseUrl on setApiKey() (a strict
  // improvement), this test will fail and we can drop both this spec and
  // the workaround in sendGrid.handler.ts. Keep it as a tripwire, not a contract.
  it('documents the bug: setApiKey() resets defaultRequest.baseUrl back to the global host', () => {
    getSendGridClient()?.setDefaultRequest('baseUrl', `http://127.0.0.1:${port}`);
    sendgrid.setApiKey('SG.test-key-EVO-1052');

    const baseUrl = getSendGridClient()?.defaultRequest.baseUrl;

    expect(baseUrl).toBe('https://api.sendgrid.com/');
  });
});
