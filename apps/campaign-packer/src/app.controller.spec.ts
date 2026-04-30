import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CampaignService } from './campaign/campaign.service';
import { FormatterUtils } from './utils/formatter.utils';

describe('AppController', () => {
  let controller: AppController;

  const mockCampaignService = {
    createContactsSend: jest.fn().mockResolvedValue('ok'),
    createBatches: jest.fn().mockResolvedValue('Processed 5 pages'),
    processPage: jest.fn().mockResolvedValue({ contacts: 10, packages: 1 }),
    createTest: jest.fn().mockResolvedValue('test created'),
    processResult: jest.fn().mockResolvedValue('result processed'),
    warmupStart: jest.fn().mockResolvedValue('warmup started'),
  };

  const mockFormatterUtils = {
    logInfo: jest.fn(),
    parseBatch: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService, { provide: CampaignService, useValue: mockCampaignService }, { provide: FormatterUtils, useValue: mockFormatterUtils }],
    }).compile();

    controller = module.get<AppController>(AppController);
    module.get<CampaignService>(CampaignService);
    module.get<FormatterUtils>(FormatterUtils);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('GET / returns hello string', () => {
    expect(controller.getHello()).toBe('Hello World!');
  });

  it('POST /create-contacts-send/:id calls service', async () => {
    await controller.postCampaign(42);
    expect(mockCampaignService.createContactsSend).toHaveBeenCalledWith(42);
  });

  it('POST /create-batches passes Campaign object to service', async () => {
    const campaign = { id: 1, title: 'Test' };
    await controller.createBatches(campaign as any);
    expect(mockCampaignService.createBatches).toHaveBeenCalledWith(campaign);
  });

  it('POST /process-page passes CampaignBatch to service', async () => {
    const batch = { campaign: { id: 1 }, page: 1, totalPages: 1, currentContactId: 1, finalContactId: 10 };
    await controller.processPage(batch as any);
    expect(mockCampaignService.processPage).toHaveBeenCalledWith(batch);
  });

  it('POST /create-test/:id delegates to service', async () => {
    await controller.createTest(5);
    expect(mockCampaignService.createTest).toHaveBeenCalledWith(5);
  });

  it('POST /result-test/:id delegates to service', async () => {
    await controller.resultTest(5);
    expect(mockCampaignService.processResult).toHaveBeenCalledWith(5);
  });

  it('POST /warmup-start passes campaign and warmups to service', async () => {
    const warmup = { campaign: { id: 1 }, warmups: [1, 2] };
    await controller.warmupStart(warmup as any);
    expect(mockCampaignService.warmupStart).toHaveBeenCalledWith({ id: 1 }, [1, 2]);
  });
});
