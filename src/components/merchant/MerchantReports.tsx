import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, TrendingDown, Clock, Users, UtensilsCrossed, AlertTriangle, Loader2, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AnalyticsData {
  time_range: string;
  order_metrics: {
    total: number;
    completed: number;
    avg_prep_time: number;
    accuracy: number;
    hourly_distribution: number[];
    peak_hour: number;
  };
  waitlist_metrics: {
    total: number;
    completed: number;
    avg_wait_time: number;
    accuracy: number;
    no_show_rate: number;
    hourly_distribution: number[];
    peak_hour: number;
  };
  insights: Array<{
    type: 'warning' | 'info' | 'success';
    category: string;
    message: string;
    action: string;
  }>;
  data_quality: {
    has_enough_order_data: boolean;
    has_enough_waitlist_data: boolean;
    order_data_points: number;
    waitlist_data_points: number;
  };
}

export const MerchantReports = ({ venue }: { venue: any }) => {
  const [timeRange, setTimeRange] = useState("today");
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!venue?.id) return;
      
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('get-venue-analytics', {
        body: { venue_id: venue.id, time_range: timeRange }
      });

      if (error) {
        console.error('Error fetching analytics:', error);
        toast({
          title: "Error",
          description: "Could not load analytics data",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      setAnalytics(data);
      setLoading(false);
    };

    fetchAnalytics();
  }, [venue?.id, timeRange, toast]);

  const MetricCard = ({ title, value, unit, icon: Icon, color = "text-primary" }: any) => (
    <Card className="shadow-card">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}{unit}</p>
          </div>
          <Icon size={32} className={color} />
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!analytics) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          No analytics data available. Start taking orders and managing your waitlist to see insights.
        </AlertDescription>
      </Alert>
    );
  }

  // Format hourly data for charts
  const hourlyOrderData = analytics.order_metrics.hourly_distribution.map((orders, hour) => ({
    hour: `${hour.toString().padStart(2, '0')}:00`,
    orders
  })).filter(d => d.orders > 0);

  const hourlyWaitlistData = analytics.waitlist_metrics.hourly_distribution.map((count, hour) => ({
    hour: `${hour.toString().padStart(2, '0')}:00`,
    count
  })).filter(d => d.count > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Reports & Analytics</h2>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="7days">Last 7 Days</SelectItem>
            <SelectItem value="30days">Last 30 Days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="food-ready" className="space-y-6">
        <TabsList>
          <TabsTrigger value="food-ready">Food Ready</TabsTrigger>
          <TabsTrigger value="table-ready">Table Ready</TabsTrigger>
          <TabsTrigger value="overview">Overview</TabsTrigger>
        </TabsList>

        <TabsContent value="food-ready" className="space-y-6">
          {/* Data Quality Indicator */}
          {!analytics.data_quality.has_enough_order_data && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Collecting data... {analytics.data_quality.order_data_points} orders tracked. 
                Need 30+ completed orders for high confidence analytics.
              </AlertDescription>
            </Alert>
          )}

          {/* Food Ready Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Total Orders"
              value={analytics.order_metrics.total}
              unit=""
              icon={UtensilsCrossed}
            />
            <MetricCard
              title="Avg Prep Time"
              value={analytics.order_metrics.avg_prep_time}
              unit="m"
              icon={Clock}
              color="text-blue-500"
            />
            <MetricCard
              title="Time Accuracy"
              value={analytics.order_metrics.accuracy}
              unit="%"
              icon={Clock}
              color={analytics.order_metrics.accuracy >= 70 ? "text-green-500" : "text-amber-500"}
            />
            <MetricCard
              title="Completed"
              value={analytics.order_metrics.completed}
              unit=""
              icon={UtensilsCrossed}
              color="text-green-500"
            />
          </div>

          {/* Hourly Orders Chart */}
          {hourlyOrderData.length > 0 ? (
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Orders by Hour</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={hourlyOrderData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="orders" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
                <p className="text-sm text-muted-foreground mt-2">
                  Peak hour: {analytics.order_metrics.peak_hour}:00
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="shadow-card p-12 text-center">
              <p className="text-muted-foreground">No order data for this period</p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="table-ready" className="space-y-6">
          {/* Data Quality Indicator */}
          {!analytics.data_quality.has_enough_waitlist_data && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Collecting data... {analytics.data_quality.waitlist_data_points} waitlist entries tracked. 
                Need 30+ completed entries for high confidence analytics.
              </AlertDescription>
            </Alert>
          )}

          {/* Table Ready Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Total Waitlist"
              value={analytics.waitlist_metrics.total}
              unit=""
              icon={Users}
            />
            <MetricCard
              title="Avg Wait Time"
              value={analytics.waitlist_metrics.avg_wait_time}
              unit="m"
              icon={Clock}
              color="text-blue-500"
            />
            <MetricCard
              title="Time Accuracy"
              value={analytics.waitlist_metrics.accuracy}
              unit="%"
              icon={Clock}
              color={analytics.waitlist_metrics.accuracy >= 70 ? "text-green-500" : "text-amber-500"}
            />
            <MetricCard
              title="No Show Rate"
              value={analytics.waitlist_metrics.no_show_rate}
              unit="%"
              icon={AlertTriangle}
              color="text-red-500"
            />
          </div>

          {/* Hourly Waitlist Chart */}
          {hourlyWaitlistData.length > 0 ? (
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Waitlist Entries by Hour</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={hourlyWaitlistData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
                <p className="text-sm text-muted-foreground mt-2">
                  Peak hour: {analytics.waitlist_metrics.peak_hour}:00
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="shadow-card p-12 text-center">
              <p className="text-muted-foreground">No waitlist data for this period</p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Orders Processed</span>
                  <Badge variant="secondary">{analytics.order_metrics.total}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Waitlist Entries</span>
                  <Badge variant="secondary">{analytics.waitlist_metrics.total}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Order Time Accuracy</span>
                  <Badge className={analytics.order_metrics.accuracy >= 70 ? "bg-green-500" : "bg-amber-500"}>
                    {analytics.order_metrics.accuracy}%
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Waitlist Time Accuracy</span>
                  <Badge className={analytics.waitlist_metrics.accuracy >= 70 ? "bg-green-500" : "bg-amber-500"}>
                    {analytics.waitlist_metrics.accuracy}%
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Insights & Recommendations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {analytics.insights.length > 0 ? (
                  analytics.insights.map((insight, idx) => (
                    <div 
                      key={idx}
                      className={`p-3 rounded-lg border ${
                        insight.type === 'warning' 
                          ? 'bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800'
                          : insight.type === 'info'
                          ? 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800'
                          : 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
                      }`}
                    >
                      <p className={`text-sm ${
                        insight.type === 'warning' 
                          ? 'text-amber-800 dark:text-amber-200'
                          : insight.type === 'info'
                          ? 'text-blue-800 dark:text-blue-200'
                          : 'text-green-800 dark:text-green-200'
                      }`}>
                        <strong>{insight.type === 'warning' ? '⚠' : insight.type === 'info' ? 'ℹ' : '✓'} {insight.category}:</strong> {insight.message}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Everything looks good! Keep monitoring your operations.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};