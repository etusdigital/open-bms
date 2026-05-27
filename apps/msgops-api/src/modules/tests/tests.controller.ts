import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiTags } from '@nestjs/swagger';
import { ClsService } from 'nestjs-cls';
import { MessagesService } from '../messages/messages.service';
import { TestAccountDto } from './test-account.dto';
import { TestCreateDto } from './test-create.dto';
import { TestCreatedDto } from './test-created.dto';
import { TestsService } from './tests.service';
import { AutomationMessageAccountService } from '../automations-messages-accounts/automations-message-account.service';
import { RequirePermission } from '../authz/require-permission.decorator';

@Controller('tests')
@ApiBearerAuth()
@ApiTags('TESTING')
export class TestsController {
  constructor(
    private readonly testsService: TestsService,
    private readonly messagesService: MessagesService,
    private readonly automationMessageAccountService: AutomationMessageAccountService,
    private readonly cls: ClsService,
  ) {}

  @ApiBody({ type: [TestCreatedDto] })
  @RequirePermission('messages:test_send')
  @Post('list')
  async listResults(@Body() testIdsForAccountDto: Array<TestCreatedDto>) {
    return await this.testsService.listResults(testIdsForAccountDto);
  }

  @RequirePermission('messages:test_send')
  @Get('account')
  async getAccount(): Promise<any> {
    return await this.testsService.getAccount();
  }

  @RequirePermission('messages:test_send')
  @Get('providers')
  async listProviders(): Promise<any> {
    return await this.testsService.getProviders();
  }

  @RequirePermission('messages:test_send')
  @Get('info/:id')
  async getMessageInfo(@Param() id: string): Promise<any> {
    return await this.testsService.getMessageInfo(id);
  }

  @RequirePermission('messages:test_send')
  @Post('automations/create')
  async automationsCreateTests(@Body() testCreateDto: TestCreateDto): Promise<Array<TestAccountDto>> {
    const accountId = this.cls.get('accountId');
    const obj = await this.testsService.createTest(testCreateDto, accountId);

    testCreateDto.messages.forEach(async (message) => {
      await this.messagesService.editTestStatus(message.id, true);
    });

    if (!obj.sent.length) {
      this.createTestResult(obj.created.TestID, 'sparkpost', accountId, testCreateDto);
      return obj;
    }

    obj.sent.forEach(async (object) => {
      this.createTestResult(object.testId || obj.created.TestID, object.activeCampaignAccountId || 'sendgrid', accountId, testCreateDto);
    });

    return obj.sent;
  }

  private async createTestResult(testId, providerAccountId, accountId, testCreateDto) {
    await this.automationMessageAccountService.createAutomationMessageAccount({
      testId: testId,
      providerAccountId: providerAccountId,
      message: {
        id: testCreateDto.messages[0].id,
      },
      provider: testCreateDto.provider,
      account: {
        id: accountId,
      },
    });
  }
}
