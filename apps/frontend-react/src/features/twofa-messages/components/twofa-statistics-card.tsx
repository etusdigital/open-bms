import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface TwoFAStatisticsCardProps {
  period: string;
  countTotal: number;
  countSuccess: number;
  countError: number;
  countVerifyValidated: number;
  countVerifyRejected: number;
}

function formatNumber(value: number): string {
  return value.toLocaleString();
}

export function TwoFAStatisticsCard({
  period,
  countTotal,
  countSuccess,
  countError,
  countVerifyValidated,
  countVerifyRejected,
}: TwoFAStatisticsCardProps) {
  const { t } = useTranslation();
  const verifyTotal = countVerifyValidated + countVerifyRejected;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-primary text-sm font-medium">{period}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Generate & Send Code */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">{t('twofaMessages.generateAndSendCode')}</h4>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs">{t('twofaMessages.countRequests')}</p>
              <p className="text-lg font-semibold">{formatNumber(countTotal)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs">{t('twofaMessages.successRequests')}</p>
              <p className="text-lg font-semibold text-green-600">{formatNumber(countSuccess)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs">{t('twofaMessages.errorRequests')}</p>
              <p className="text-lg font-semibold text-red-600">{formatNumber(countError)}</p>
            </div>
          </div>
        </div>

        {/* Validate Code */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">{t('twofaMessages.validateCode')}</h4>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs">{t('twofaMessages.countRequests')}</p>
              <p className="text-lg font-semibold">{formatNumber(verifyTotal)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs">{t('twofaMessages.validated2FA')}</p>
              <p className="text-lg font-semibold text-green-600">{formatNumber(countVerifyValidated)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs">{t('twofaMessages.rejected2FA')}</p>
              <p className="text-lg font-semibold text-red-600">{formatNumber(countVerifyRejected)}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
