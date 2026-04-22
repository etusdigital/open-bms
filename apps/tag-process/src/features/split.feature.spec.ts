import { Step } from '../interfaces';
import { Config, SplitFeature } from './split.feature';

const mockEmptySplitTerm = '';
const mockCorrectSplitTerm = '5:qh-f24h:flx_plusdin_com_br:contato@flx.plusdin.com.br';

const mockSplitTermWithoutCampaign = '5::flx_plusdin_com_br:contato@flx.plusdin.com.br';

const mockStep = {
  position: 1,
  id: 'shun_teste_version_cc-73-222',
  type: 'email',
  value: null,
  config: {
    id: 123,
    title: 'shun-email-teste-2',
    previewText: null,
    ippool: 'dev_test_mail_only',
    subject: 'Ola %FIRSTNAME% shnteste2',
    replyTo: null,
    priority: 'normal',
    location: {
      bucketName: 'msgops-assets-stg.example.com',
      fileName: 'templates/automation_messages/108/template.txt',
    },
    from: {
      firstName: 'Example Sender',
      email: 'sender@example.com',
    },
    to: {
      firstName: 'Example Recipient',
      email: 'recipient@example.com',
    },
  },
} as Step;

describe('SplitService', () => {
  let splitService: SplitFeature;

  beforeEach(() => {
    splitService = new SplitFeature();
  });

  describe('Function: getConfig', () => {
    it('should return null if not found env', () => {
      delete process.env.FEATURE_SPLIT_TERM;
      const result = splitService.getConfig();
      expect(result).toBe(null);
    });

    it('should return null if env is empty', () => {
      process.env.FEATURE_SPLIT_TERM = mockEmptySplitTerm;
      const result = splitService.getConfig();
      expect(result).toBeFalsy();
    });

    it('should return object properties if correct process env', () => {
      process.env.FEATURE_SPLIT_TERM = mockCorrectSplitTerm;
      const result = splitService.getConfig();

      expect(typeof result).toBe('object');
      expect(result).toBeTruthy();
    });

    it('should return null if term without campaign', () => {
      process.env.FEATURE_SPLIT_TERM = mockSplitTermWithoutCampaign;
      const result = splitService.getConfig();
      expect(typeof result).toBe('object');
      expect(result).toBeFalsy();
    });

    it('should return object with percent, pool and sender with correct process env', () => {
      process.env.FEATURE_SPLIT_TERM = mockCorrectSplitTerm;
      const result = splitService.getConfig();
      expect(result.percent).toBe(5);
      expect(result.pool).toBe('flx_plusdin_com_br');
      expect(result.sender).toBe('contato@flx.plusdin.com.br');
    });
  });

  describe('Function: shouldChange', () => {
    it('should return false because is different automation title', () => {
      process.env.FEATURE_SPLIT_TERM = mockCorrectSplitTerm;
      const config = splitService.getConfig();
      const shouldChange = splitService.shouldChange('plusdin-cc-24hrs', config);
      expect(shouldChange).toBeFalsy();
    });

    describe('should return false because have empty values', () => {
      it('automation title is empty', () => {
        process.env.FEATURE_SPLIT_TERM = mockCorrectSplitTerm;
        const config = splitService.getConfig();
        const shouldChange = splitService.shouldChange('', config);
        expect(shouldChange).toBeFalsy();
      });
    });
  });

  describe('Function: updateStepEmail', () => {
    it('should create new step keeping the config changes', () => {
      const config: Config = {
        automationId: 'qh-f24h',
        percent: 5,
        pool: 'flx_plusdin_com_br',
        sender: 'contato@flx.plusdin.com.br',
      };

      const newStep = splitService.updateStepEmail(mockStep, config);
      expect(newStep.config.ippool).toBe(config.pool);
      expect(newStep.config.from.email).toBe(config.sender);
      expect(newStep.config.from.firstName).toBe(mockStep.config.from.firstName);
      expect(newStep.config.subject).toBe(mockStep.config.subject);
      expect(newStep.config.title).toBe(mockStep.config.title);
      expect(newStep.config.priority).toBe(mockStep.config.priority);
      expect(newStep.config.location.bucketName).toBe(mockStep.config.location.bucketName);
      expect(newStep.config.to.firstName).toBe(mockStep.config.to.firstName);
    });
  });
});
