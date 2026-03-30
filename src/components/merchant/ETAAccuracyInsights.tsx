import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TrendingUp, TrendingDown, Target, Clock } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface ETAAccuracyInsightsProps {
  venueId: string;
}

interface AccuracyData {
  prepAccuracy: number | null;
  prepAvgDeviation: number | null;
  prepDataPoints: number;
  waitAccuracy: number | null;
  waitAvgDeviation: number | null;
  waitDataPoints: number;
}

export const ETAAccuracyInsights = ({ venueId }: ETAAccuracyInsightsProps) => {
  const [data, setData] = useState<AccuracyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAccuracy = async () => {
      try {
        // Food prep accuracy (last 30 days)
        const { data: prepData } = await supabase
          .from("order_analytics")
          .select("quoted_prep_time, actual_prep_time")
          .eq("venue_id", venueId)
          .not("actual_prep_time", "is", null)
          .gte("placed_at", new Date(Date.now() - 30 * 86400000).toISOString());

        // Waitlist accuracy (last 30 days)
        const { data: waitData } = await supabase
          .from("waitlist_analytics")
          .select("quoted_wait_time, actual_wait_time")
          .eq("venue_id", venueId)
          .not("actual_wait_time", "is", null)
          .gte("joined_at", new Date(Date.now() - 30 * 86400000).toISOString());

        let prepAccuracy: number | null = null;
        let prepAvgDeviation: number | null = null;
        const prepPoints = prepData?.length || 0;

        if (prepData && prepData.length >= 3) {
          const deviations = prepData.map(r => Math.abs(r.actual_prep_time - r.quoted_prep_time));
          prepAvgDeviation = deviations.reduce((a, b) => a + b, 0) / deviations.length;
          const withinThreshold = prepData.filter(r => Math.abs(r.actual_prep_time - r.quoted_prep_time) <= 5).length;
          prepAccuracy = (withinThreshold / prepData.length) * 100;
        }

        let waitAccuracy: number | null = null;
        let waitAvgDeviation: number | null = null;
        const waitPoints = waitData?.length || 0;

        if (waitData && waitData.length >= 3) {
          const deviations = waitData.map(r => Math.abs(r.actual_wait_time - r.quoted_wait_time));
          waitAvgDeviation = deviations.reduce((a, b) => a + b, 0) / deviations.length;
          const withinThreshold = waitData.filter(r => Math.abs(r.actual_wait_time - r.quoted_wait_time) <= 5).length;
          waitAccuracy = (withinThreshold / waitData.length) * 100;
        }

        setData({ prepAccuracy, prepAvgDeviation, prepDataPoints: prepPoints, waitAccuracy, waitAvgDeviation, waitDataPoints: waitPoints });
      } catch (err) {
        console.error("Error fetching ETA accuracy:", err);
      } finally {
        setLoading(false);
      }
    };

    if (venueId) fetchAccuracy();
  }, [venueId]);

  if (loading || !data) return null;
  if (data.prepDataPoints < 3 && data.waitDataPoints < 3) return null;

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold flex items-center gap-2">
        <Target className="h-4 w-4" />
        ETA Prediction Accuracy (Last 30 Days)
      </h4>

      {data.prepAccuracy !== null && (
        <div className="rounded-lg border p-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              Food Prep ETA
            </span>
            <span className="font-medium">
              {data.prepAccuracy.toFixed(0)}% accurate
            </span>
          </div>
          <Progress value={data.prepAccuracy} className="h-2" />
          <p className="text-xs text-muted-foreground">
            Avg deviation: ±{data.prepAvgDeviation?.toFixed(1)} min · {data.prepDataPoints} orders
          </p>
        </div>
      )}

      {data.waitAccuracy !== null && (
        <div className="rounded-lg border p-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              Waitlist ETA
            </span>
            <span className="font-medium">
              {data.waitAccuracy.toFixed(0)}% accurate
            </span>
          </div>
          <Progress value={data.waitAccuracy} className="h-2" />
          <p className="text-xs text-muted-foreground">
            Avg deviation: ±{data.waitAvgDeviation?.toFixed(1)} min · {data.waitDataPoints} entries
          </p>
        </div>
      )}

      {(data.prepAccuracy !== null && data.prepAccuracy < 60) && (
        <Alert variant="destructive">
          <TrendingDown className="h-4 w-4" />
          <AlertTitle>Low Food Prep Accuracy</AlertTitle>
          <AlertDescription>
            Only {data.prepAccuracy.toFixed(0)}% of orders are ready within 5 min of the quoted time. The system will auto-adjust as more data comes in.
          </AlertDescription>
        </Alert>
      )}

      {(data.waitAccuracy !== null && data.waitAccuracy < 60) && (
        <Alert variant="destructive">
          <TrendingDown className="h-4 w-4" />
          <AlertTitle>Low Waitlist Accuracy</AlertTitle>
          <AlertDescription>
            Only {data.waitAccuracy.toFixed(0)}% of wait times are within 5 min of predictions. Consider reviewing staffing during peak hours.
          </AlertDescription>
        </Alert>
      )}

      {(data.prepAccuracy !== null && data.prepAccuracy >= 85) && (
        <Alert>
          <TrendingUp className="h-4 w-4" />
          <AlertTitle>Excellent Prep Predictions</AlertTitle>
          <AlertDescription>
            {data.prepAccuracy.toFixed(0)}% accuracy — your kitchen timing is highly predictable.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
