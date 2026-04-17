import { ForbiddenException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailsTemplatesEntity } from '../../entities/emails-templates.entity';
import { EmailsTemplatesDto } from './emails-templates.dto';
import { NewEmailsTemplatesDto } from './new-emails-templates.dto';
import { EmailTemplatePageDto } from './email-template-page.dto';
import { PaginationDto } from '../../dtos/pagination.dto';
import { GoogleCloudStorageProvider } from '../../providers/google-cloud-storage.provider';
import * as crypto from 'crypto';
import { PostgresErrorCode } from 'src/shared.interfaces';
import { ClsService } from 'nestjs-cls';
import { replaceSpecialChars } from 'src/utils/utils.service';
// import Puppeteer from 'puppeteer';

@Injectable()
export class EmailsTemplatesService {
  constructor(
    @InjectRepository(EmailsTemplatesEntity)
    private readonly emailTemplateRepository: Repository<EmailsTemplatesEntity>,

    private readonly gcsProvider: GoogleCloudStorageProvider,
    private readonly cls: ClsService,
  ) {}

  async delete(id: number): Promise<void> {
    await this.emailTemplateRepository.findOneOrFail({ where: { id, accountId: this.cls.get('accountId') } });

    try {
      await this.emailTemplateRepository.softDelete(id);
    } catch (e) {
      console.error(e);
      throw new HttpException(e.response || 'Internal Server Error', e.status || HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async createCopy(id: number): Promise<EmailsTemplatesDto> {
    const templateCopy = await this.findOneById(id);
    templateCopy.name += ' - copy';

    delete templateCopy.id;
    delete templateCopy.createdAt;
    delete templateCopy.updatedAt;

    return await this.create(templateCopy);
  }

  async edit(emailTemplateDto: EmailsTemplatesDto): Promise<EmailsTemplatesDto> {
    try {
      const emailTemplate = await this.emailTemplateRepository.findOneOrFail({
        where: {
          id: emailTemplateDto.id,
          accountId: this.cls.get('accountId'),
        },
      });

      //const base64 = await this.exportHtmlToBase64(emailTemplateDto.html_template);
      //const upload = await this.uploadImage(`data:image/png;base64,${base64}`, crypto.createHash('md5') + '.png');

      //emailTemplateDto.image_template = upload ? upload.link : null;
      this.emailTemplateRepository.merge(emailTemplate, emailTemplateDto);
      await this.emailTemplateRepository.update(emailTemplate.id, emailTemplate);
      return emailTemplate;
    } catch (error) {
      if (error?.code === PostgresErrorCode.UniqueViolation) {
        throw new ForbiddenException('Template with that name already exists');
      }

      throw new HttpException(error.response || 'Internal Server Error', error.status || HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async create(emailTemplateDto: NewEmailsTemplatesDto): Promise<EmailsTemplatesDto> {
    try {
      //const base64 = await this.exportHtmlToBase64(emailTemplateDto.html_template);
      //const upload = await this.uploadImage(`data:image/png;base64,${base64}`, crypto.createHash('md5') + '.png');

      const emailTemplate = this.emailTemplateRepository.create({
        name: emailTemplateDto.name,
        description: emailTemplateDto.description,
        html_template: emailTemplateDto.html_template,
        json_template: emailTemplateDto.json_template,
        //image_template: upload ? upload.link : null,
        account: { id: this.cls.get('accountId') },
      });

      const saved = await this.emailTemplateRepository.save(emailTemplate);

      return saved;
    } catch (error) {
      if (error?.code === PostgresErrorCode.UniqueViolation) {
        throw new ForbiddenException('Template with that name already exists');
      }

      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async listPaginated(params: EmailTemplatePageDto): Promise<PaginationDto<EmailsTemplatesEntity>> {
    try {
      const sortBy = params.sortBy ? params.sortBy : 'createdAt';
      const order = params.order ? params.order : 'ASC';
      const emailTemplateQuery = await this.emailTemplateRepository
        .createQueryBuilder('emails_templates')
        .where({ accountId: this.cls.get('accountId') })
        .skip((params.page - 1) * params.itemsPerPage)
        .take(params.itemsPerPage)
        .orderBy(`emails_templates.${sortBy}`, `${order}`);

      if (params.name) {
        emailTemplateQuery.andWhere(`(emails_templates.name iLike :search OR emails_templates.description iLike :search)`, {
          search: `%${params.name}%`,
        });
      }

      const [results, total] = await emailTemplateQuery.getManyAndCount();

      return new PaginationDto<EmailsTemplatesEntity>({
        results: results,
        total,
        page: params.page,
        itemsPerPage: params.itemsPerPage,
      });
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async findAll(): Promise<Array<EmailsTemplatesEntity>> {
    try {
      return await this.emailTemplateRepository.find({
        where: { accountId: this.cls.get('accountId') },
        order: {
          createdAt: 'DESC',
        },
      });
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async findOneById(id: number): Promise<EmailsTemplatesEntity> {
    try {
      return await this.emailTemplateRepository.findOneOrFail({ where: { id, accountId: this.cls.get('accountId') } });
    } catch (e) {
      console.error(e);
      throw new HttpException(e.response || 'Internal Server Error', e.status || HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // async exportHtmlToBase64(html: string): Promise<Buffer | string> {
  //   const browser = await Puppeteer.launch();
  //   const page = await browser.newPage();
  //   await page.setViewport({
  //     width: 600,
  //     height: 500,
  //     deviceScaleFactor: 1,
  //   });
  //   await page.setContent(html);
  //   return await page.screenshot({ encoding: 'base64' });
  // }

  async uploadImage(data: string, name: string): Promise<any> {
    const cleanName = replaceSpecialChars(name);

    const fileDTO = {
      name: cleanName,
      ext: `.${cleanName.substring(data.indexOf('/'), data.indexOf(';'))}`,
      mime: data.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/)[1],
      buffer: Buffer.from(data.replace(/^data:image\/\w+;base64,/, ''), 'base64'),
      hash: crypto.createHash('md5').update(cleanName).digest('hex'),
      path: 'tmp/msgops',
    };

    return await this.gcsProvider.upload(false, 0, fileDTO, 'templates/emails');
  }
}
