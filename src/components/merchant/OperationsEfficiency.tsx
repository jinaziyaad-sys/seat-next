import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, CheckCircle2, TrendingUp, Calendar } from "lucide-react";
import { toast } from "sonner";
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
}

export const OperationsEfficiency = ({ venueId }: OperationsEfficiencyProps) => {
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("30days");
  const [summary, setSummary] = useState<EfficiencySummary | null>(null);
  const [peakHours, setPeakHours] = useState<PeakHour[]>([]);
  const [busiestDays, setBusiestDays] = useState<any[]>([]);
  const [onTimeByHour, setOnTimeByHour] = useState<any[]>([]);
  const [prepTimeTrend, setPrepTimeTrend] = useState<any[]>([]);
  const [staffLeaderboard, setStaffLeaderboard] = useState<StaffMember[]>([]);

  useEffect(() => {
    if (venueId) {
      fetchEfficiencyAnalytics();
    }
  }, [venueId, timeRange]);

  const fetchEfficiencyAnalytics = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error("Not authenticated");
        return;
      }

      const { data, error } = await supabase.functions.invoke('get-venue-efficiency-analytics', {
        body: { venue_id: venueId, time_range: timeRange },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      setSummary(data.summary);
      setPeakHours(data.peak_hours);
      setBusiestDays(data.busiest_days);
      setOnTimeByHour(data.on_time_by_hour);
      setPrepTimeTrend(data.prep_time_trend);
      setStaffLeaderboard(data.staff_leaderboard);
    } catch (error: any) {
      console.error("Error fetching efficiency analytics:", error);
      toast.error(error.message || "Failed to load efficiency analytics");
    } finally {
      setLoading(false);
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
      {/* Time Range Selector */}
      <div className="flex justify-end">
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="7days">Last 7 Days</SelectItem>
            <SelectItem value="30days">Last 30 Days</SelectItem>
            <SelectItem value="90days">Last 90 Days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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

      {/* Staff Leaderboard */}
      {staffLeaderboard.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Staff Performance Leaderboard</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rank</TableHead>
                  <TableHead>Staff Member</TableHead>
                  <TableHead className="text-center">Orders Completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staffLeaderboard.map((staff, index) => (
                  <TableRow key={staff.staff_id}>
                    <TableCell>
                      <Badge variant={index === 0 ? "default" : "secondary"}>
                        #{index + 1}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{staff.name}</TableCell>
                    <TableCell className="text-center">{staff.orders_completed}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};