import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, CheckCircle2, TrendingUp, Calendar } from "lucide-react";
import { startOfDay, subDays, endOfDay, startOfToday } from "date-fns";
import { DateRangePicker } from "./DateRangePicker";
import { ComparativeMetrics } from "./ComparativeMetrics";
import { SmartInsights } from "./SmartInsights";
import { StaffPerformance } from "./StaffPerformance";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";

interface EfficiencySummary {
  avg_prep_time: number;
  on_time_rate: number;
  avg_wait_time: number;
  total_orders: number;
  total_waitlist: number;
}

interface PeakHour {
  hour: number;
  count: number;
}

interface StaffMember {
  staff_id: string;
  name: string;
  orders_completed: number;
}

interface OperationsEfficiencyProps {
  venueId: string;
  venueCreatedAt?: string;
}

export const OperationsEfficiency = ({ venueId, venueCreatedAt }: OperationsEfficiencyProps) => {
  const [loading, setLoading] = useState(true);
  const today = startOfToday();
  const [startDate, setStartDate] = useState<Date>(startOfDay(subDays(today, 30)));
  const [endDate, setEndDate] = useState<Date>(endOfDay(today));
  const [summary, setSummary] = useState<EfficiencySummary | null>(null);
  const [previousSummary, setPreviousSummary] = useState<EfficiencySummary | null>(null);
  const [peakHours, setPeakHours] = useState<PeakHour[]>([]);
  const [busiestDays, setBusiestDays] = useState<any[]>([]);
  const [onTimeByHour, setOnTimeByHour] = useState<any[]>([]);
  const [prepTimeTrend, setPrepTimeTrend] = useState<any[]>([]);
  const [staffLeaderboard, setStaffLeaderboard] = useState<StaffMember[]>([]);

  const handleDateChange = (start: Date, end: Date) => {
    setStartDate(start);
    setEndDate(end);
  };

  useEffect(() => {
    if (venueId) {
      fetchEfficiencyAnalytics();
    }
  }, [venueId, startDate, endDate]);

  const fetchEfficiencyAnalytics = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.error("Not authenticated");
        return;
      }

      const { data, error } = await supabase.functions.invoke('get-venue-efficiency-analytics', {
        body: { 
          venue_id: venueId, 
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
        },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;

      setSummary(data.summary);
      setPeakHours(data.peak_hours);
      setBusiestDays(data.busiest_days);
      setOnTimeByHour(data.on_time_by_hour);
      setPrepTimeTrend(data.prep_time_trend);
      setStaffLeaderboard(data.staff_leaderboard);

      // Fetch comparison data from daily snapshots
      await fetchComparisonData();
    } catch (error: any) {
      console.error("Error fetching efficiency analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchComparisonData = async () => {
    try {
      // Calculate days in selected range for comparison period
      const daysInRange = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const compareEndDate = new Date(startDate);
      compareEndDate.setDate(compareEndDate.getDate() - 1);
      const compareStartDate = new Date(compareEndDate);
      compareStartDate.setDate(compareStartDate.getDate() - daysInRange);

      const { data: snapshots } = await supabase
        .from('daily_venue_snapshots')
        .select('*')
        .eq('venue_id', venueId)
        .gte('snapshot_date', compareStartDate.toISOString().split('T')[0])
        .lte('snapshot_date', compareEndDate.toISOString().split('T')[0]);

      if (snapshots && snapshots.length > 0) {
        const avgPrepTime = snapshots.reduce((sum, s) => sum + (s.avg_prep_time_minutes || 0), 0) / snapshots.length;
        const avgOnTime = snapshots.reduce((sum, s) => sum + (s.on_time_percentage || 0), 0) / snapshots.length;
        const avgWaitTime = snapshots.reduce((sum, s) => sum + (s.avg_wait_time_minutes || 0), 0) / snapshots.length;
        const totalOrders = snapshots.reduce((sum, s) => sum + (s.total_orders || 0), 0);
        const totalWaitlist = snapshots.reduce((sum, s) => sum + (s.total_waitlist_joins || 0), 0);

        setPreviousSummary({
          avg_prep_time: parseFloat(avgPrepTime.toFixed(1)),
          on_time_rate: parseFloat(avgOnTime.toFixed(1)),
          avg_wait_time: parseFloat(avgWaitTime.toFixed(1)),
          total_orders: totalOrders,
          total_waitlist: totalWaitlist,
        });
      }
    } catch (error) {
      console.error("Error fetching comparison data:", error);
    }
  };

  const formatHour = (hour: number) => {
    const period = hour >= 12 ? "PM" : "AM";
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}${period}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading efficiency analytics...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Smart Insights */}
      {summary && (
        <Card>
          <CardHeader>
            <CardTitle>Operational Performance Insights</CardTitle>
            <CardDescription>Smart recommendations to optimize your operations</CardDescription>
          </CardHeader>
          <CardContent>
            <SmartInsights
              data={{
                orderMetrics: {
                  avgPrepTime: summary.avg_prep_time,
                  onTimeRate: summary.on_time_rate,
                  totalOrders: summary.total_orders,
                },
                efficiencyMetrics: {
                  avgWaitTime: summary.avg_wait_time,
                  peakHours: peakHours.slice(0, 3).map(h => ({ hour: h.hour, count: h.count })),
                  onTimePerformanceByHour: onTimeByHour.map(h => ({ hour: h.hour, rate: h.on_time_rate })),
                },
              }}
              type="operations"
            />
          </CardContent>
        </Card>
      )}

      {/* Date Range Selector */}
      <div className="flex justify-end">
        <DateRangePicker
          venueCreatedAt={venueCreatedAt}
          startDate={startDate}
          endDate={endDate}
          onDateChange={handleDateChange}
        />
      </div>

      {/* Summary Cards with Comparisons */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {previousSummary ? (
            <>
              <ComparativeMetrics
                title="Avg Prep Time"
                currentValue={summary.avg_prep_time}
                previousValue={previousSummary.avg_prep_time}
                unit=" min"
                format="time"
                reverseColors={true}
              />
              <ComparativeMetrics
                title="On-Time Rate"
                currentValue={summary.on_time_rate}
                previousValue={previousSummary.on_time_rate}
                unit="%"
                format="percentage"
              />
              <ComparativeMetrics
                title="Avg Wait Time"
                currentValue={summary.avg_wait_time}
                previousValue={previousSummary.avg_wait_time}
                unit=" min"
                format="time"
                reverseColors={true}
              />
              <ComparativeMetrics
                title="Total Volume"
                currentValue={summary.total_orders + summary.total_waitlist}
                previousValue={previousSummary.total_orders + previousSummary.total_waitlist}
                format="number"
              />
            </>
          ) : (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg Prep Time</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{summary.avg_prep_time} min</div>
                  <p className="text-xs text-muted-foreground">Per order</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">On-Time Rate</CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{summary.on_time_rate}%</div>
                  <p className="text-xs text-muted-foreground">Orders ready on time</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg Wait Time</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{summary.avg_wait_time} min</div>
                  <p className="text-xs text-muted-foreground">For waitlist</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Volume</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{summary.total_orders}</div>
                  <p className="text-xs text-muted-foreground">Orders + {summary.total_waitlist} waitlist</p>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* Charts Row 1 */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Peak Hours */}
        <Card>
          <CardHeader>
            <CardTitle>Peak Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={peakHours}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" tickFormatter={formatHour} />
                <YAxis />
                <Tooltip
                  labelFormatter={formatHour}
                  formatter={(value: any) => [`${value} orders`, "Volume"]}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" name="Orders" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Busiest Days */}
        <Card>
          <CardHeader>
            <CardTitle>Busiest Days</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={busiestDays}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day_name" />
                <YAxis />
                <Tooltip formatter={(value: any) => [`${value} orders`, "Volume"]} />
                <Bar dataKey="count" fill="hsl(var(--chart-2))" name="Orders" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* On-Time Performance by Hour */}
        <Card>
          <CardHeader>
            <CardTitle>On-Time Rate by Hour</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={onTimeByHour}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" tickFormatter={formatHour} />
                <YAxis domain={[0, 100]} />
                <Tooltip
                  labelFormatter={formatHour}
                  formatter={(value: any) => [`${value.toFixed(1)}%`, "On-Time Rate"]}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="on_time_rate"
                  stroke="hsl(var(--chart-3))"
                  name="On-Time %"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Prep Time Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Prep Time Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={prepTimeTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                />
                <YAxis />
                <Tooltip
                  labelFormatter={(value) => new Date(value).toLocaleDateString()}
                  formatter={(value: any) => [`${value.toFixed(1)} min`, "Avg Prep Time"]}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="avg_prep_time"
                  stroke="hsl(var(--chart-4))"
                  name="Avg Prep Time"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Staff Performance (Detailed) */}
      <StaffPerformance venueId={venueId} startDate={startDate} endDate={endDate} />
    </div>
  );
};