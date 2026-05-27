import { TestResultDto } from './test-result.dto';

export class TestResultWithProviderDto extends TestResultDto {
  providers: Array<TestResultDto>;
  link?: string;
}
