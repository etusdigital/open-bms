import { SplitFeature } from './split.feature';
import { TrackerService } from '../../tracker/tracker.service';

const mockEmptySplitTerm = '';
const mockCorrectSplitTerm = '5:qh-f24h:DIA-01:flx_plusdin_com_br:contato@flx.plusdin.com.br';

const mockSplitTermWithoutCampaign = '5::DIA-01:flx_plusdin_com_br:contato@flx.plusdin.com.br';

describe('SplitService', () => {
  let splitService: SplitFeature;

  beforeEach(() => {
    const trackerService = new TrackerService();
    splitService = new SplitFeature(trackerService);
  });

  describe('getConfig', () => {
    it('should return null if not found env', () => {
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

    it('should return null if term withou campaign', () => {
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

  describe('shouldChange', () => {
    it('should return false because is different automation title', () => {
      const config = splitService.getConfig();
      const shouldChange = splitService.shouldChange('plusdin-cc-24hrs', 'DIA1-01', config);
      expect(shouldChange).toBeFalsy();
    });

    describe('should return false because have empty values', () => {
      it('automation title is empty', () => {
        const config = splitService.getConfig();
        const shouldChange = splitService.shouldChange('', 'DIA1-01', config);
        expect(shouldChange).toBeFalsy();
      });
      it('email id is empty', () => {
        const config = splitService.getConfig();
        const shouldChange = splitService.shouldChange('plusdin-cc-24hrs', '', config);
        expect(shouldChange).toBeFalsy();
      });
      it('automation title is null', () => {
        const config = splitService.getConfig();
        const shouldChange = splitService.shouldChange(null, 'DIA1-01', config);
        expect(shouldChange).toBeFalsy();
      });
      it('email id is null', () => {
        const config = splitService.getConfig();
        const shouldChange = splitService.shouldChange('plusdin-cc-24hrs', null, config);
        expect(shouldChange).toBeFalsy();
      });
      it('automation title is undefined', () => {
        const config = splitService.getConfig();
        const shouldChange = splitService.shouldChange(undefined, 'DIA1-01', config);
        expect(shouldChange).toBeFalsy();
      });
      it('email id is undefined', () => {
        const config = splitService.getConfig();
        const shouldChange = splitService.shouldChange('plusdin-cc-24hrs', undefined, config);
        expect(shouldChange).toBeFalsy();
      });
    });
  });
});
