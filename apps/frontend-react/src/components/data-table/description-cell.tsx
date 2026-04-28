import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface DescriptionCellProps {
  description?: string | null;
}

export function DescriptionCell({ description }: DescriptionCellProps) {
  if (!description) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <p className="text-muted-foreground mt-0.5 max-w-[260px] truncate text-xs">{description}</p>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="start" className="max-w-xs">
          <p className="text-xs">{description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
