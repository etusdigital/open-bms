import { TestResultWithProviderDto } from './test-result-with-provider.dto';

export class TestResultWithProviderAndSenderDto extends TestResultWithProviderDto {
  senders: Array<TestResultWithProviderDto>;
}
