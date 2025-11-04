import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, UserPlus, Repeat, TrendingUp, Calendar, Award } from "lucide-react";
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
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";

interface CustomerInsightsSummary {
  total_customers: number;
  new_customers: number;
  active_customers: number;
  returning_customers: number;
  return_rate: number;
  avg_visit_frequency_days: number;
}

interface CustomerSegments {
  new: number;
  active: number;
  regular: number;
  at_risk: number;
  inactive: number;
}

interface LoyalCustomer {
  user_id: string;
  name: string;
  total_orders: number;
  total_waitlist_joins: number;
  total_activity: number;
  last_visit: string;
  days_since_last_visit: number;
}

interface CustomerInsightsProps {
  venueId: string;
}

const SEGMENT_COLORS: Record<string, string> = {
  new: "hsl(var(--chart-1))",
  active: "hsl(var(--chart-2))",
  regular: "hsl(var(--chart-3))",
  at_risk: "hsl(var(--chart-4))",
  inactive: "hsl(var(--chart-5))",
};

export const CustomerInsights = ({ venueId }: CustomerInsightsProps) => {
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("30days");
  const [summary, setSummary] = useState<CustomerInsightsSummary | null>(null);
  const [segments, setSegments] = useState<CustomerSegments | null>(null);
  const [loyalCustomers, setLoyalCustomers] = useState<LoyalCustomer[]>([]);
  const [activityTrend, setActivityTrend] = useState<any[]>([]);

  useEffect(() => {
    if (venueId) {
      fetchCustomerInsights();
    }
  }, [venueId, timeRange]);

  const fetchCustomerInsights = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error("Not authenticated");
        return;
      }

      const { data, error } = await supabase.functions.invoke('get-venue-customer-insights', {
        body: { venue_id: venueId, time_range: timeRange },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      setSummary(data.summary);
      setSegments(data.segments);
      setLoyalCustomers(data.top_loyal_customers);
      setActivityTrend(data.activity_trend);
    } catch (error: any) {
      console.error("Error fetching customer insights:", error);
      toast.error(error.message || "Failed to load customer insights");
    } finally {
      setLoading(false);
    }
  };

  const segmentData = segments
    ? Object.entries(segments).map(([key, value]) => ({
        name: key.charAt(0).toUpperCase() + key.slice(1),
        value,
        fill: SEGMENT_COLORS[key] || "hsl(var(--muted))",
      }))
    : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading customer insights...</div>
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
              <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.total_customers}</div>
              <p className="text-xs text-muted-foreground">All-time</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">New Customers</CardTitle>
              <UserPlus className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.new_customers}</div>
              <p className="text-xs text-muted-foreground">This period</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Return Rate</CardTitle>
              <Repeat className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.return_rate}%</div>
              <p className="text-xs text-muted-foreground">
                {summary.returning_customers} returning
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Visit Frequency</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {summary.avg_visit_frequency_days.toFixed(1)} days
              </div>
              <p className="text-xs text-muted-foreground">Between visits</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Customer Segments Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Customer Segments</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={segmentData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {segmentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2">
              {segmentData.map((segment) => (
                <div key={segment.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: segment.fill }}
                    />
                    <span className="text-sm">{segment.name}</span>
                  </div>
                  <span className="text-sm font-medium">{segment.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Customer Growth Trend */}
        <Card>
          <CardHeader>
            <CardTitle>New Customer Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={activityTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                />
                <YAxis />
                <Tooltip
                  labelFormatter={(value) => new Date(value).toLocaleDateString()}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="hsl(var(--primary))"
                  name="New Customers"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Loyal Customers Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Top Loyal Customers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead className="text-center">Orders</TableHead>
                <TableHead className="text-center">Waitlist</TableHead>
                <TableHead className="text-center">Total Activity</TableHead>
                <TableHead>Last Visit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loyalCustomers.map((customer) => (
                <TableRow key={customer.user_id}>
                  <TableCell className="font-medium">{customer.name}</TableCell>
                  <TableCell className="text-center">{customer.total_orders}</TableCell>
                  <TableCell className="text-center">{customer.total_waitlist_joins}</TableCell>
                  <TableCell className="text-center">
                    <Badge>{customer.total_activity}</Badge>
                  </TableCell>
                  <TableCell>
                    {customer.last_visit
                      ? new Date(customer.last_visit).toLocaleDateString()
                      : "Never"}
                    {customer.days_since_last_visit !== null && (
                      <div className="text-xs text-muted-foreground">
                        {customer.days_since_last_visit}d ago
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {loyalCustomers.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              No customer data available yet
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};