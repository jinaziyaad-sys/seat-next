import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface ComparativeMetricsProps {
  title: string;
  currentValue: number;
  previousValue: number;
  unit?: string;
  format?: 'number' | 'percentage' | 'time';
  reverseColors?: boolean; // If true, decrease is good (like prep time)
}

export const ComparativeMetrics = ({
  title,
  currentValue,
  previousValue,
  unit = '',
  format = 'number',
  reverseColors = false,
}: ComparativeMetricsProps) => {
  const calculateChange = () => {
    if (previousValue === 0) return { percent: 0, direction: 'neutral' as const };
    
    const percentChange = ((currentValue - previousValue) / previousValue) * 100;
    
    if (Math.abs(percentChange) < 1) return { percent: 0, direction: 'neutral' as const };
    if (percentChange > 0) return { percent: percentChange, direction: 'up' as const };
    return { percent: Math.abs(percentChange), direction: 'down' as const };
  };

  const { percent, direction } = calculateChange();

  const isPositive = reverseColors 
    ? direction === 'down' 
    : direction === 'up';

  const isNegative = reverseColors
    ? direction === 'up'
    : direction === 'down';

  const formatValue = (value: number) => {
    switch (format) {
      case 'percentage':
        return `${value.toFixed(1)}%`;
      case 'time':
        return `${value.toFixed(1)}${unit}`;
      default:
        return `${value}${unit}`;
    }
  };

  const TrendIcon = direction === 'up' ? TrendingUp : direction === 'down' ? TrendingDown : Minus;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <TrendIcon 
          className={cn(
            "h-4 w-4",
            direction === 'neutral' && "text-muted-foreground",
            isPositive && "text-green-500",
            isNegative && "text-red-500"
          )} 
        />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formatValue(currentValue)}</div>
        <div className="flex items-center gap-2 mt-1">
          <p className={cn(
            "text-xs font-medium",
            direction === 'neutral' && "text-muted-foreground",
            isPositive && "text-green-600",
            isNegative && "text-red-600"
          )}>
            {direction === 'neutral' ? (
              "No change"
            ) : (
              <>
                {direction === 'up' ? '+' : '-'}{percent.toFixed(1)}%
              </>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            vs previous period
          </p>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Previous: {formatValue(previousValue)}
        </p>
      </CardContent>
    </Card>
  );
};
