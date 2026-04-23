import { ClassSerializerInterceptor, Controller, Get, Query, UseInterceptors, NotFoundException, Req, Res, Post, Param, Body, HttpCode } from '@nestjs/common';
import { Response, Request } from 'express';
import { MsgopsService } from './msgops/msgops.service';
import { SkipThrottle } from '@nestjs/throttler';
import { IpAddress } from './decorators/ip-address.decorator';
import { AppService } from './app.service';

@SkipThrottle()
@Controller()
export class AppController {
  constructor(
    private readonly msgOpsService: MsgopsService,
    private readonly appService: AppService,
  ) {}

  @SkipThrottle({ default: false })
  @Post(['/c', '/bms/c'])
  @HttpCode(200)
  @UseInterceptors(ClassSerializerInterceptor)
  async findContact(@Body() body: any): Promise<unknown> {
    try {
      const buff = Buffer.from(body.data, 'base64');
      const params = JSON.parse(buff.toString('ascii'));

      const key = Object.keys(params);
      const propsFilter = ['e', 'h', 'u'];
      if (!key.length || !propsFilter.includes(key[0])) {
        throw new NotFoundException();
      }
      return this.msgOpsService.findContact(key[0], params[key[0]]);
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  @SkipThrottle({ default: false })
  @Post(['/cs', '/bms/cs'])
  @HttpCode(200)
  @UseInterceptors(ClassSerializerInterceptor)
  async findContactSegment(@Body() body: any): Promise<unknown> {
    try {
      const buff = Buffer.from(body.data, 'base64');
      const params = JSON.parse(buff.toString('ascii'));

      if (!params.i) {
        throw new NotFoundException();
      }
      return this.msgOpsService.findContactTags(params.i);
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  @Get('/redirect')
  redirect(@Res() response: Response, @Req() request: Request, @Query('url') url: string, @Query('bmsu') bmsu: string) {
    const buff = Buffer.from(url, 'base64');
    const decodedUrl = buff.toString('ascii');
    const parsedUrl = new URL(decodeURIComponent(decodedUrl));
    const urlSearchParams = new URLSearchParams(parsedUrl.search);
    const urlParams = Object.fromEntries(urlSearchParams.entries());
    let bmsUUID = bmsu;
    let utmId = null;
    let bmst = null;
    if (!bmsu) {
      bmsUUID = urlParams.bmsu || urlParams.bmsuuid;
    }
    if (urlParams.utm_id) {
      utmId = urlParams.utm_id;
      urlSearchParams.delete('utm_id');
    }
    if (urlParams.bmst) {
      bmst = urlParams.bmst;
      urlSearchParams.delete('bmst');
    }
    if (urlParams.bmsa) {
      urlSearchParams.delete('bmsa');
    }

    urlSearchParams.delete('bmsu');
    urlSearchParams.delete('bmsuuid');

    const domain = request.hostname.split('.');
    const rootDomain = domain
      .slice(0)
      .slice(-(domain.length === 4 ? 3 : 2))
      .join('.');

    const redirectTo = `${parsedUrl.origin}${parsedUrl.pathname}?${urlSearchParams.toString()}`;
    response.cookie('bmsUUID', `${bmsUUID}`, {
      domain: rootDomain,
      path: '/',
      secure: true,
    });

    // don't fetch contact for account Just Great Cards (288), Vouquitar (16), and Mejoresopciones (22)
    // if (bmsUUID && ['288', '16', '22'].includes(accountId) !== true) {
    //   try {
    //     const contact = await this.msgOpsService.findContact('u', bmsUUID, accountId);
    //     if (contact) {
    //       /**
    //        * Since user is comming from email link, we consider this as a valid click event
    //        * We update the last click and last open timestamps and set a cookie with contact info
    //        * Contact will be latter updated in the database in the event-process service
    //        */
    //       const currentTimestamp = new Date().toISOString();
    //       contact.lc = currentTimestamp;
    //       contact.lo = currentTimestamp;
    //       response.cookie('bmsInfo', JSON.stringify(contact), {
    //         domain: rootDomain,
    //         path: '/',
    //         secure: true,
    //         maxAge: 2 * 24 * 60 * 60 * 1000, // 2 days
    //       });
    //     }
    //   } catch (error) {
    //     console.error('Error fetching contact by bmsUUID:', JSON.stringify(error));
    //   }
    // }

    if (utmId) {
      response.cookie('utm_id', `${utmId}`, {
        domain: rootDomain,
        path: '/',
        secure: true,
      });
    }
    if (bmst) {
      response.cookie('bmst', `${bmst}`, {
        domain: rootDomain,
        path: '/',
        secure: true,
      });
    }

    if (redirectTo.includes('cardfacil')) {
      console.log(`REDIRECT DONE: ${redirectTo}`);
    }

    return response.redirect(302, redirectTo);
  }

  @Post(['/ac', '/bms/ac'])
  @HttpCode(200)
  @UseInterceptors(ClassSerializerInterceptor)
  async getAccounts(@Body() body: any): Promise<unknown> {
    try {
      const buff = Buffer.from(body.data, 'base64');
      const params = JSON.parse(buff.toString('ascii'));

      const keys = Object.keys(params);
      const propsFilter = ['e', 'h', 'u'];
      if (!keys.length || !propsFilter.includes(keys[0])) {
        throw new NotFoundException();
      }

      let email = params[keys[0]];
      if (keys[0] !== 'e') {
        const contact = await this.msgOpsService.findContact(keys[0], params[keys[0]]);
        email = contact.email;
      }

      const contacts = await this.msgOpsService.accountsByEmail(email);
      const result = {};
      for (const account of contacts) {
        result[account.accountId] = account.lo;
      }

      return result;
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  @Get(['/contacts', '/bms/contacts'])
  async findContacts(@Query('email') email: string, @Query('includes') options: string[]): Promise<unknown> {
    return this.appService.findContactsByEmail(email, options);
  }

  @Get('/:shortCode')
  async redirectShortCode(@Req() request: Request, @Res() response: Response, @Param('shortCode') shortCode: string, @IpAddress() ipAddress?: string) {
    return await this.appService.processShortLink(shortCode, ipAddress, response, request.headers);
  }
}
