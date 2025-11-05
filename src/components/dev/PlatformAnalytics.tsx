import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { 
  TrendingUp, 
  Users, 
  Store, 
  ShoppingBag, 
  Star, 
  AlertCircle, 
  Activity,
  Clock,
  UserCheck,
  Calendar
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

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
  };
  waitlist: {
    total_entries: number;
    avg_wait_accuracy_pct: number;
    no_show_rate_pct: number;
  };
  top_venues: {
    by_orders: { venue_id: string; name: string; count: number }[];
    by_rating: { venue_id: string; name: string; avg_rating: number; rating_count: number }[];
    most_active: { venue_id: string; name: string; count: number }[];
  };
  growth: {
    daily_signups: { date: string; count: number }[];
    daily_orders: { date: string; count: number }[];
  };
  health: {
    active_venue_pct: number;
    active_venue_count: number;
  };
}

export function PlatformAnalytics() {
  const [data, setData] = useState<PlatformAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: analytics, error: err } = await supabase.functions.invoke('get-platform-analytics');

      if (err) throw err;

      setData(analytics);
    } catch (err: any) {
      console.error('Error fetching platform analytics:', err);
      setError(err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
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
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Venues</CardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.total_venues}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.health.active_venue_count} active (last 7d)
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Users (30d)</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.active_users_30d}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {userActivationRate}% of total patrons
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">New Signups (7d)</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.new_signups_7d}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.summary.new_signups_30d} in last 30d
              {growthRate7to30 > 100 && (
                <span className="text-success ml-1">↑ {growthRate7to30}%</span>
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Platform Rating</CardTitle>
            <Star className="h-4 w-4 text-warning fill-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-1">
              {data.summary.platform_avg_rating.toFixed(1)}
              <Star className="h-5 w-5 text-warning fill-warning" />
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
              {data.orders.total_this_month} this month
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
                  <Badge variant="default" className="bg-success">Excellent</Badge>
                ) : data.orders.avg_prep_accuracy_pct >= 70 ? (
                  <Badge variant="secondary" className="bg-warning">Good</Badge>
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
                  <Badge variant="default" className="bg-success">Excellent</Badge>
                ) : data.waitlist.avg_wait_accuracy_pct >= 70 ? (
                  <Badge variant="secondary" className="bg-warning">Good</Badge>
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
                  <Badge variant="default" className="bg-success">Excellent</Badge>
                ) : data.waitlist.no_show_rate_pct <= 20 ? (
                  <Badge variant="secondary" className="bg-warning">Acceptable</Badge>
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
                  <Badge variant="default" className="bg-success">Healthy</Badge>
                ) : data.health.active_venue_pct >= 50 ? (
                  <Badge variant="secondary" className="bg-warning">Moderate</Badge>
                ) : (
                  <Badge variant="destructive">Low</Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top Performing Venues */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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
                    <span className="text-sm truncate">{venue.name}</span>
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
                    <span className="text-sm truncate">{venue.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-semibold">{venue.avg_rating.toFixed(1)}</span>
                    <Star className="h-3 w-3 text-warning fill-warning" />
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
                    <span className="text-sm truncate">{venue.name}</span>
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
              Daily Signups (Last 30 Days)
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
              Daily Orders (Last 30 Days)
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

      {/* Alerts - Venues Needing Attention */}
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
              <div>⏸️ Low venue activity ({data.health.active_venue_pct}%) - many venues inactive in last 7 days</div>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}