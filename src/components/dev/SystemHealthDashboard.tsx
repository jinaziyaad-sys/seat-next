import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Users, AlertTriangle, Store, ShoppingBag, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subDays } from 'date-fns';

interface HealthMetrics {
  activeUsers: number;
  totalVenues: number;
  todayOrders: number;
  yesterdayOrders: number;
  openErrors: number;
  errorTrend: { date: string; count: number }[];
}

export function SystemHealthDashboard() {
  const [metrics, setMetrics] = useState<HealthMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    setLoading(true);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString();
    const sevenDaysAgo = subDays(now, 7).toISOString();
    const recentThreshold = subDays(now, 7).toISOString();

    const [
      { count: activeUsers },
      { count: totalVenues },
      { count: todayOrders },
      { count: yesterdayOrders },
      { count: openErrors },
      { data: errorData },
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('updated_at', recentThreshold),
      supabase.from('venues').select('*', { count: 'exact', head: true }),
      supabase.from('orders').select('*', { count: 'exact', head: true }).gte('created_at', todayStart),
      supabase.from('orders').select('*', { count: 'exact', head: true }).gte('created_at', yesterdayStart).lt('created_at', todayStart),
      supabase.from('platform_errors').select('*', { count: 'exact', head: true }).eq('status', 'new'),
      supabase.from('platform_errors').select('created_at').gte('created_at', sevenDaysAgo).order('created_at'),
    ]);

    // Group errors by day
    const errorsByDay: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = format(subDays(now, i), 'MMM dd');
      errorsByDay[d] = 0;
    }
    (errorData || []).forEach((e: any) => {
      const d = format(new Date(e.created_at), 'MMM dd');
      if (d in errorsByDay) errorsByDay[d]++;
    });

    setMetrics({
      activeUsers: activeUsers || 0,
      totalVenues: totalVenues || 0,
      todayOrders: todayOrders || 0,
      yesterdayOrders: yesterdayOrders || 0,
      openErrors: openErrors || 0,
      errorTrend: Object.entries(errorsByDay).map(([date, count]) => ({ date, count })),
    });
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!metrics) return null;

  const orderDelta = metrics.yesterdayOrders > 0
    ? Math.round(((metrics.todayOrders - metrics.yesterdayOrders) / metrics.yesterdayOrders) * 100)
    : metrics.todayOrders > 0 ? 100 : 0;

  const statCards = [
    { label: 'Active Users (7d)', value: metrics.activeUsers, icon: Users, color: 'text-blue-500' },
    { label: 'Total Venues', value: metrics.totalVenues, icon: Store, color: 'text-green-500' },
    { label: 'Orders Today', value: metrics.todayOrders, icon: ShoppingBag, color: 'text-amber-500', delta: orderDelta },
    { label: 'Open Errors', value: metrics.openErrors, icon: AlertTriangle, color: metrics.openErrors > 0 ? 'text-red-500' : 'text-green-500' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Activity className="h-5 w-5" />
        <h2 className="text-lg font-semibold">System Health</h2>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                  <span className="text-xs text-muted-foreground">{stat.label}</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold">{stat.value}</span>
                  {'delta' in stat && stat.delta !== undefined && (
                    <span className={`text-xs ${stat.delta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {stat.delta >= 0 ? '+' : ''}{stat.delta}% vs yesterday
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Error Trend (Last 7 Days)</CardTitle>
          <CardDescription>New errors reported per day</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.errorTrend}>
                <XAxis dataKey="date" fontSize={12} />
                <YAxis allowDecimals={false} fontSize={12} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
