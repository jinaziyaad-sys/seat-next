import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { 
  TrendingUp, 
  TrendingDown,
  Users, 
  Store, 
  ShoppingBag, 
  Star, 
  AlertCircle, 
  Activity,
  Clock,
  UserCheck,
  Calendar,
  RefreshCw,
  XCircle,
  CheckCircle,
  UserX,
  Percent
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { DateRangePicker } from "@/components/merchant/DateRangePicker";
import { VenueHealthReport } from "./VenueHealthReport";
import { startOfDay, subDays, endOfDay, startOfToday } from "date-fns";

interface PlatformAnalytics {
  summary: {
    total_venues: number;
    total_patrons: number;
    active_users_30d: number;
    new_signups_7d: number;
    new_signups_30d: number;
    platform_avg_rating: number;
  };
  orders: {
    total_orders: number;
    orders_by_status: { status: string; count: number }[];
    avg_prep_accuracy_pct: number;
    total_this_month: number;
    cancelled_count: number;
    rejected_count: number;
    completed_count: number;
    conversion_rate: number;
  };
  waitlist: {
    total_entries: number;
    avg_wait_accuracy_pct: number;
    no_show_rate_pct: number;
    seated_count: number;
    cancelled_count: number;
    conversion_rate: number;
  };
  top_venues: {
    by_orders: { venue_id: string; name: string; count: number }[];
    by_rating: { venue_id: string; name: string; avg_rating: number; rating_count: number }[];
    most_active: { venue_id: string; name: string; count: number }[];
  };
  growth: {
    daily_signups: { date: string; count: number }[];
    daily_orders: { date: string; count: number }[];
    daily_waitlist: { date: string; count: number }[];
  };
  health: {
    active_venue_pct: number;
    active_venue_count: number;
    inactive_venues: { venue_id: string; name: string; last_activity: string | null }[];
  };
  customer_retention: {
    returning_customers: number;
    new_customers: number;
    retention_rate: number;
  };
}

const STATUS_COLORS: Record<string, string> = {
  placed: "hsl(var(--chart-1))",
  in_prep: "hsl(var(--chart-2))",
  ready: "hsl(var(--chart-3))",
  collected: "hsl(var(--chart-4))",
  cancelled: "hsl(var(--chart-5))",
  rejected: "hsl(var(--destructive))",
  no_show: "hsl(var(--muted-foreground))",
};

export function PlatformAnalytics() {
  const today = startOfToday();
  const [startDate, setStartDate] = useState<Date>(startOfDay(subDays(today, 30)));
  const [endDate, setEndDate] = useState<Date>(endOfDay(today));
  const [data, setData] = useState<PlatformAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleDateChange = (start: Date, end: Date) => {
    setStartDate(start);
    setEndDate(end);
  };

  useEffect(() => {
    fetchAnalytics();
  }, [startDate, endDate]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: analytics, error: err } = await supabase.functions.invoke('get-platform-analytics', {
        body: {
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
        }
      });

      if (err) throw err;

      setData(analytics);
    } catch (err: any) {
      console.error('Error fetching platform analytics:', err);
      setError(err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const orderStatusData = useMemo(() => {
    if (!data?.orders.orders_by_status) return [];
    return data.orders.orders_by_status
      .filter(s => s.count > 0)
      .map(s => ({
        name: s.status.charAt(0).toUpperCase() + s.status.slice(1).replace('_', ' '),
        value: s.count,
        fill: STATUS_COLORS[s.status] || "hsl(var(--muted))",
      }));
  }, [data]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-end">
          <Skeleton className="h-10 w-64" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error || 'Failed to load analytics'}</AlertDescription>
      </Alert>
    );
  }

  const userActivationRate = data.summary.total_patrons > 0
    ? Math.round((data.summary.active_users_30d / data.summary.total_patrons) * 100)
    : 0;

  const growthRate7to30 = data.summary.new_signups_30d > 0 && data.summary.new_signups_7d > 0
    ? Math.round(((data.summary.new_signups_7d * 4.3) / data.summary.new_signups_30d) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Date Range Picker */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-2xl font-bold">Platform Analytics</h2>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchAnalytics}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onDateChange={handleDateChange}
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Venues</CardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.total_venues}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.health.active_venue_count} active in period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Patrons</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.total_patrons}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <TrendingUp className="inline h-3 w-3 mr-1" />
              {data.summary.new_signups_7d} new (last 7d)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Users</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.active_users_30d}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {userActivationRate}% activation rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Platform Rating</CardTitle>
            <Star className="h-4 w-4 text-primary fill-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-1">
              {data.summary.platform_avg_rating.toFixed(1)}
              <Star className="h-5 w-5 text-primary fill-primary" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Average across all venues
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Orders</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.orders.total_orders}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.orders.completed_count} completed ({data.orders.conversion_rate}%)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Order Cancellations</CardTitle>
            <XCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.orders.cancelled_count}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.orders.rejected_count} rejected
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Waitlist Entries</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.waitlist.total_entries}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.waitlist.seated_count} seated ({data.waitlist.conversion_rate}%)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Customer Retention</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.customer_retention.retention_rate}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.customer_retention.returning_customers} returning / {data.customer_retention.new_customers} new
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Platform Health Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Platform Health Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Order Prep Accuracy</div>
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold">{data.orders.avg_prep_accuracy_pct}%</div>
                {data.orders.avg_prep_accuracy_pct >= 90 ? (
                  <Badge className="bg-success text-success-foreground">Excellent</Badge>
                ) : data.orders.avg_prep_accuracy_pct >= 70 ? (
                  <Badge variant="secondary">Good</Badge>
                ) : (
                  <Badge variant="destructive">Needs Attention</Badge>
                )}
              </div>
            </div>

            <div>
              <div className="text-sm text-muted-foreground mb-1">Waitlist Accuracy</div>
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold">{data.waitlist.avg_wait_accuracy_pct}%</div>
                {data.waitlist.avg_wait_accuracy_pct >= 90 ? (
                  <Badge className="bg-success text-success-foreground">Excellent</Badge>
                ) : data.waitlist.avg_wait_accuracy_pct >= 70 ? (
                  <Badge variant="secondary">Good</Badge>
                ) : (
                  <Badge variant="destructive">Needs Attention</Badge>
                )}
              </div>
            </div>

            <div>
              <div className="text-sm text-muted-foreground mb-1">No-Show Rate</div>
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold">{data.waitlist.no_show_rate_pct}%</div>
                {data.waitlist.no_show_rate_pct <= 10 ? (
                  <Badge className="bg-success text-success-foreground">Excellent</Badge>
                ) : data.waitlist.no_show_rate_pct <= 20 ? (
                  <Badge variant="secondary">Acceptable</Badge>
                ) : (
                  <Badge variant="destructive">High</Badge>
                )}
              </div>
            </div>

            <div>
              <div className="text-sm text-muted-foreground mb-1">Active Venues</div>
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold">{data.health.active_venue_pct}%</div>
                {data.health.active_venue_pct >= 80 ? (
                  <Badge className="bg-success text-success-foreground">Healthy</Badge>
                ) : data.health.active_venue_pct >= 50 ? (
                  <Badge variant="secondary">Moderate</Badge>
                ) : (
                  <Badge variant="destructive">Low</Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Order Status Breakdown + Top Venues */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Order Status Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Order Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {orderStatusData.length > 0 ? (
              <div className="space-y-3">
                {orderStatusData.map((status) => {
                  const percentage = data.orders.total_orders > 0 
                    ? Math.round((status.value / data.orders.total_orders) * 100) 
                    : 0;
                  return (
                    <div key={status.name} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: status.fill }}
                          />
                          <span>{status.name}</span>
                        </div>
                        <span className="font-medium">{status.value}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ 
                            width: `${percentage}%`,
                            backgroundColor: status.fill 
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No order data</p>
            )}
          </CardContent>
        </Card>

        {/* Top Venues */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Venues by Orders</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.top_venues.by_orders.length > 0 ? (
              data.top_venues.by_orders.map((venue, idx) => (
                <div key={venue.venue_id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant={idx === 0 ? "default" : "secondary"}>#{idx + 1}</Badge>
                    <span className="text-sm truncate max-w-[120px]">{venue.name}</span>
                  </div>
                  <span className="text-sm font-semibold">{venue.count}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No data available</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Venues by Rating</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.top_venues.by_rating.length > 0 ? (
              data.top_venues.by_rating.map((venue, idx) => (
                <div key={venue.venue_id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant={idx === 0 ? "default" : "secondary"}>#{idx + 1}</Badge>
                    <span className="text-sm truncate max-w-[100px]">{venue.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-semibold">{venue.avg_rating.toFixed(1)}</span>
                    <Star className="h-3 w-3 text-primary fill-primary" />
                    <span className="text-xs text-muted-foreground">({venue.rating_count})</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No data available</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Most Active Recently</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.top_venues.most_active.length > 0 ? (
              data.top_venues.most_active.map((venue, idx) => (
                <div key={venue.venue_id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant={idx === 0 ? "default" : "secondary"}>
                      {idx === 0 && <Activity className="h-3 w-3 mr-1" />}
                      {idx === 0 ? 'Hot' : `#${idx + 1}`}
                    </Badge>
                    <span className="text-sm truncate max-w-[100px]">{venue.name}</span>
                  </div>
                  <span className="text-sm font-semibold">{venue.count}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No data available</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Growth Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Daily Signups
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={data.growth.daily_signups}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => new Date(value).getDate().toString()}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip 
                  labelFormatter={(value) => new Date(value).toLocaleDateString()}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))' 
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingBag className="h-4 w-4" />
              Daily Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.growth.daily_orders}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => new Date(value).getDate().toString()}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip 
                  labelFormatter={(value) => new Date(value).toLocaleDateString()}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))' 
                  }}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Inactive Venues Alert */}
      {data.health.inactive_venues && data.health.inactive_venues.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <UserX className="h-4 w-4" />
              Inactive Venues ({data.health.inactive_venues.length})
            </CardTitle>
            <CardDescription>
              These venues have had no activity in the selected period
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {data.health.inactive_venues.slice(0, 9).map((venue) => (
                <div key={venue.venue_id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                  <span className="text-sm truncate">{venue.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {venue.last_activity 
                      ? new Date(venue.last_activity).toLocaleDateString() 
                      : 'Never'}
                  </span>
                </div>
              ))}
            </div>
            {data.health.inactive_venues.length > 9 && (
              <p className="text-sm text-muted-foreground mt-2">
                +{data.health.inactive_venues.length - 9} more inactive venues
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Platform Issues Alert */}
      {(data.orders.avg_prep_accuracy_pct < 70 || 
        data.waitlist.avg_wait_accuracy_pct < 70 || 
        data.waitlist.no_show_rate_pct > 20 ||
        data.health.active_venue_pct < 50) && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Platform Issues Detected</AlertTitle>
          <AlertDescription className="space-y-1">
            {data.orders.avg_prep_accuracy_pct < 70 && (
              <div>🔴 Low order prep accuracy ({data.orders.avg_prep_accuracy_pct}%) - venues need timing improvements</div>
            )}
            {data.waitlist.avg_wait_accuracy_pct < 70 && (
              <div>⚠️ Low waitlist accuracy ({data.waitlist.avg_wait_accuracy_pct}%) - venues need capacity management</div>
            )}
            {data.waitlist.no_show_rate_pct > 20 && (
              <div>⚠️ High no-show rate ({data.waitlist.no_show_rate_pct}%) - consider implementing confirmation reminders</div>
            )}
            {data.health.active_venue_pct < 50 && (
              <div>⏸️ Low venue activity ({data.health.active_venue_pct}%) - many venues inactive</div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Venue Health Report */}
      <VenueHealthReport />
    </div>
  );
}
