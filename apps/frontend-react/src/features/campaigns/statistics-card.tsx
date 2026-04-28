import { Card, CardContent } from '@/components/ui/card';

interface StatisticsCardProps {
  label: string;
  value: string | number;
  suffix?: string;
}

export default function StatisticsCard({ label, value, suffix }: StatisticsCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="text-2xl font-bold">
          {typeof value === 'number' ? value.toLocaleString() : value}
          {suffix && <span className="text-muted-foreground ml-0.5 text-sm font-normal">{suffix}</span>}
        </p>
      </CardContent>
    </Card>
  );
}
