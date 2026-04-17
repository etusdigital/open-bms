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
    schedulePage: jest.fn().mockResolvedValue('task-abc'),
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

  it('POST /create-batches passes direct Campaign object', async () => {
    const campaign = { id: 1, title: 'Test' };
    await controller.createBatches(campaign as any);
    expect(mockCampaignService.createBatches).toHaveBeenCalledWith(campaign);
  });

  it('POST /create-batches parses Pub/Sub envelope', async () => {
    const parsed = { id: 1, title: 'Test' };
    mockFormatterUtils.parseBatch.mockReturnValue(parsed);
    const data = { subscription: 'sub', message: { data: 'abc', messageId: '1', message_id: '1', publishTime: '', publish_time: '', attributes: { key: '' } } };
    await controller.createBatches(data as any);
    expect(mockFormatterUtils.parseBatch).toHaveBeenCalled();
    expect(mockCampaignService.createBatches).toHaveBeenCalledWith(parsed);
  });

  it('POST /schedule-pages passes direct PageMessage', async () => {
    const page = { payload: '{}', waitFor: 0, page: 1 };
    await controller.schedulePages(page as any);
    expect(mockCampaignService.schedulePage).toHaveBeenCalledWith(page);
  });

  it('POST /process-page passes direct CampaignBatch', async () => {
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

  it('POST /warmup-start parses warmup object directly', async () => {
    const warmup = { campaign: { id: 1 }, warmups: [1, 2] };
    await controller.warmupStart(warmup as any);
    expect(mockCampaignService.warmupStart).toHaveBeenCalledWith({ id: 1 }, [1, 2]);
  });

  it('POST /warmup-start parses Pub/Sub envelope', async () => {
    const parsed = { campaign: { id: 1 }, warmups: [1, 2] };
    mockFormatterUtils.parseBatch.mockReturnValue(parsed);
    const data = { subscription: 'sub', message: { data: 'abc', messageId: '1', message_id: '1', publishTime: '', publish_time: '', attributes: { key: '' } } };
    await controller.warmupStart(data as any);
    expect(mockFormatterUtils.parseBatch).toHaveBeenCalled();
    expect(mockCampaignService.warmupStart).toHaveBeenCalledWith({ id: 1 }, [1, 2]);
  });
});
