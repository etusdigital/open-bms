import { Injectable, NestMiddleware, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { MsgopsService } from 'src/msgops/msgops.service';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class AccountMiddleware implements NestMiddleware {
  constructor(
    private readonly msgopsService: MsgopsService,
    private readonly cls: ClsService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    let accountId: number;
    if (this.cls.get('apiKey')) {
      const accountConfig = await this.msgopsService.findByConfig(this.cls.get('apiKey').toString());
      accountId = accountConfig?.accountId || null;
    }

    if (!accountId) {
      throw new HttpException('[Unauthorized]', HttpStatus.UNAUTHORIZED);
    }

    this.cls.set('accountId', accountId);

    if (req.headers['x-requester'] && req.headers['x-requester'] === 'mobile') {
      next();
      return;
    }

    // const acceptOrigins = [
    //   'cardfacil.com',
    //   'dinheirohj.com',
    //   'dinheironapratica.com.br',
    //   'easydinheiro.com',
    //   'gotallcards.com',
    //   'helpcartao.com',
    //   'lidandocomdinheiro.com',
    //   'mejoresopciones.com.mx',
    //   'pecaoseu.com',
    //   'plusdin.com.br',
    //   'querocartao.com',
    //   'solicitecartao.com',
    //   'tarjetaahora.com',
    //   'tarjetasargentinas.com',
    //   'unum.com.br',
    //   'utilizecartoes.com',
    //   'viajarcomvantagem.com',
    //   'vouquitar.com',
    //   'wheresmycard.com',
    //   'cardoffersnow.com',
    // ];

    // if (process.env.NODE_ENV === 'development') {
    //   acceptOrigins.push('localhost');
    //   acceptOrigins.push('127.0.0.1');
    // }
    // if (!req.get('origin') || !acceptOrigins.some((domain) => req.get('origin').includes(domain))) {
    //   throw new HttpException('[Unauthorized]', HttpStatus.UNAUTHORIZED);
    // }

    next();
  }
}
