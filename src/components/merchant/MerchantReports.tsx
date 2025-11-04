import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, TrendingDown, Clock, Users, UtensilsCrossed, AlertTriangle, Loader2, Info, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { RatingsView } from "./RatingsView";
import { CustomerInsights } from "./CustomerInsights";
import { OperationsEfficiency } from "./OperationsEfficiency";
import * as XLSX from 'xlsx';

interface AnalyticsData {
  time_range: string;
  order_metrics: {
    total: number;
    completed: number;
    avg_prep_time: number;
    performance: {
      early_rate: number;
      early_count: number;
      avg_advance: number;
      on_time_rate: number;
      on_time_count: number;
      late_rate: number;
      late_count: number;
      avg_delay: number;
    };
    hourly_distribution: number[];
    peak_hour: number;
  };
  waitlist_metrics: {
    total: number;
    completed: number;
    avg_wait_time: number;
    performance: {
      early_rate: number;
      early_count: number;
      avg_advance: number;
      on_time_rate: number;
      on_time_count: number;
      late_rate: number;
      late_count: number;
      avg_delay: number;
    };
    no_show_rate: number;
    hourly_distribution: number[];
    peak_hour: number;
  };
  insights: Array<{
    type: 'warning' | 'info' | 'success';
    category: string;
    message: string;
    action: string | null;
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
  const [exportLoading, setExportLoading] = useState(false);
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

  const handleExportData = async () => {
    if (!venue?.id) return;
    
    setExportLoading(true);
    try {
      // Calculate date range based on timeRange state
      const now = new Date();
      let startDate = new Date();
      
      switch (timeRange) {
        case 'today':
          startDate.setHours(0, 0, 0, 0);
          break;
        case '7days':
          startDate.setDate(now.getDate() - 7);
          break;
        case '30days':
          startDate.setDate(now.getDate() - 30);
          break;
      }

      // Fetch all data in parallel
      const [ordersData, orderAnalyticsData, waitlistData, waitlistAnalyticsData, ratingsData] = await Promise.all([
        supabase
          .from('orders')
          .select('*')
          .eq('venue_id', venue.id)
          .gte('created_at', startDate.toISOString())
          .order('created_at', { ascending: false }),
        
        supabase
          .from('order_analytics')
          .select('*')
          .eq('venue_id', venue.id)
          .gte('placed_at', startDate.toISOString())
          .order('placed_at', { ascending: false }),
        
        supabase
          .from('waitlist_entries')
          .select('*')
          .eq('venue_id', venue.id)
          .gte('created_at', startDate.toISOString())
          .order('created_at', { ascending: false }),
        
        supabase
          .from('waitlist_analytics')
          .select('*')
          .eq('venue_id', venue.id)
          .gte('joined_at', startDate.toISOString())
          .order('joined_at', { ascending: false }),
        
        supabase
          .from('order_ratings')
          .select('*')
          .eq('venue_id', venue.id)
          .gte('created_at', startDate.toISOString())
          .order('created_at', { ascending: false })
      ]);

      // Create workbook
      const wb = XLSX.utils.book_new();

      // Sheet 1: Orders
      if (ordersData.data && ordersData.data.length > 0) {
        const ordersSheet = XLSX.utils.json_to_sheet(ordersData.data.map(o => ({
          'Order Number': o.order_number,
          'Customer Name': o.customer_name,
          'Customer Phone': o.customer_phone,
          'Status': o.status,
          'Items': JSON.stringify(o.items),
          'ETA': o.eta ? new Date(o.eta).toLocaleString() : 'N/A',
          'Notes': o.notes || '',
          'Created At': new Date(o.created_at).toLocaleString(),
          'Updated At': new Date(o.updated_at).toLocaleString(),
        })));
        XLSX.utils.book_append_sheet(wb, ordersSheet, 'Orders');
      }

      // Sheet 2: Order Analytics
      if (orderAnalyticsData.data && orderAnalyticsData.data.length > 0) {
        const analyticsSheet = XLSX.utils.json_to_sheet(orderAnalyticsData.data.map(o => ({
          'Order ID': o.order_id,
          'Placed At': new Date(o.placed_at).toLocaleString(),
          'In Prep At': o.in_prep_at ? new Date(o.in_prep_at).toLocaleString() : 'N/A',
          'Ready At': o.ready_at ? new Date(o.ready_at).toLocaleString() : 'N/A',
          'Collected At': o.collected_at ? new Date(o.collected_at).toLocaleString() : 'N/A',
          'Quoted Prep Time (min)': o.quoted_prep_time,
          'Actual Prep Time (min)': o.actual_prep_time || 'N/A',
          'Items Count': o.items_count,
          'Hour of Day': o.hour_of_day,
          'Day of Week': o.day_of_week,
          'Delay Reason': o.delay_reason || '',
        })));
        XLSX.utils.book_append_sheet(wb, analyticsSheet, 'Order Analytics');
      }

      // Sheet 3: Waitlist Entries
      if (waitlistData.data && waitlistData.data.length > 0) {
        const waitlistSheet = XLSX.utils.json_to_sheet(waitlistData.data.map(w => ({
          'Customer Name': w.customer_name,
          'Customer Phone': w.customer_phone,
          'Party Size': w.party_size,
          'Status': w.status,
          'Position': w.position || 'N/A',
          'Preferences': w.preferences ? w.preferences.join(', ') : 'None',
          'ETA': w.eta ? new Date(w.eta).toLocaleString() : 'N/A',
          'Created At': new Date(w.created_at).toLocaleString(),
          'Updated At': new Date(w.updated_at).toLocaleString(),
        })));
        XLSX.utils.book_append_sheet(wb, waitlistSheet, 'Waitlist');
      }

      // Sheet 4: Waitlist Analytics
      if (waitlistAnalyticsData.data && waitlistAnalyticsData.data.length > 0) {
        const waitlistAnalyticsSheet = XLSX.utils.json_to_sheet(waitlistAnalyticsData.data.map(w => ({
          'Entry ID': w.entry_id,
          'Party Size': w.party_size,
          'Joined At': new Date(w.joined_at).toLocaleString(),
          'Ready At': w.ready_at ? new Date(w.ready_at).toLocaleString() : 'N/A',
          'Seated At': w.seated_at ? new Date(w.seated_at).toLocaleString() : 'N/A',
          'Quoted Wait Time (min)': w.quoted_wait_time,
          'Actual Wait Time (min)': w.actual_wait_time || 'N/A',
          'Was No Show': w.was_no_show ? 'Yes' : 'No',
          'Hour of Day': w.hour_of_day,
          'Day of Week': w.day_of_week,
        })));
        XLSX.utils.book_append_sheet(wb, waitlistAnalyticsSheet, 'Waitlist Analytics');
      }

      // Sheet 5: Ratings
      if (ratingsData.data && ratingsData.data.length > 0) {
        const ratingsSheet = XLSX.utils.json_to_sheet(ratingsData.data.map(r => ({
          'Order ID': r.order_id,
          'Rating': r.rating,
          'Feedback': r.feedback_text || 'No feedback',
          'Created At': new Date(r.created_at).toLocaleString(),
        })));
        XLSX.utils.book_append_sheet(wb, ratingsSheet, 'Ratings');
      }

      // Generate filename
      const timeRangeLabel = timeRange === 'today' ? 'Today' : timeRange === '7days' ? 'Last-7-Days' : 'Last-30-Days';
      const filename = `${venue.name.replace(/[^a-z0-9]/gi, '_')}_${timeRangeLabel}_${new Date().toISOString().split('T')[0]}.xlsx`;

      // Download
      XLSX.writeFile(wb, filename);

      toast({
        title: "Success",
        description: "Data exported successfully",
      });

    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Error",
        description: "Failed to export data",
        variant: "destructive",
      });
    } finally {
      setExportLoading(false);
    }
  };

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
        <div className="flex items-center gap-2">
          <Button 
            onClick={handleExportData} 
            disabled={exportLoading}
            variant="outline"
          >
            <Download className="mr-2 h-4 w-4" />
            {exportLoading ? "Exporting..." : "Export to Excel"}
          </Button>
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
      </div>

      <Tabs defaultValue="food-ready" className="space-y-6">
        <TabsList>
          <TabsTrigger value="food-ready">Food Ready</TabsTrigger>
          <TabsTrigger value="table-ready">Table Ready</TabsTrigger>
          <TabsTrigger value="customer-insights">Customer Insights</TabsTrigger>
          <TabsTrigger value="operations">Operations</TabsTrigger>
          <TabsTrigger value="ratings">Ratings</TabsTrigger>
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
              title="Completed"
              value={analytics.order_metrics.completed}
              unit=""
              icon={UtensilsCrossed}
              color="text-green-500"
            />
            <MetricCard
              title="Peak Hour"
              value={`${analytics.order_metrics.peak_hour}:00`}
              unit=""
              icon={TrendingUp}
              color="text-purple-500"
            />
          </div>

          {/* Performance Breakdown - Three Brackets */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Performance Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Clock className="text-green-500" size={20} />
                    <span className="font-semibold text-green-600 dark:text-green-400">Early Orders</span>
                  </div>
                  <p className="text-3xl font-bold">{analytics.order_metrics.performance.early_rate}%</p>
                  <p className="text-sm text-muted-foreground">
                    {analytics.order_metrics.performance.early_count} orders
                  </p>
                  {analytics.order_metrics.performance.avg_advance > 0 && (
                    <p className="text-xs text-muted-foreground">
                      ~{analytics.order_metrics.performance.avg_advance}min ahead of ETA
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Clock className="text-blue-500" size={20} />
                    <span className="font-semibold text-blue-600 dark:text-blue-400">On Time Orders</span>
                  </div>
                  <p className="text-3xl font-bold">{analytics.order_metrics.performance.on_time_rate}%</p>
                  <p className="text-sm text-muted-foreground">
                    {analytics.order_metrics.performance.on_time_count} orders
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ±5 minutes of ETA
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Clock className="text-red-500" size={20} />
                    <span className="font-semibold text-red-600 dark:text-red-400">Late Orders</span>
                  </div>
                  <p className="text-3xl font-bold">{analytics.order_metrics.performance.late_rate}%</p>
                  <p className="text-sm text-muted-foreground">
                    {analytics.order_metrics.performance.late_count} orders
                  </p>
                  {analytics.order_metrics.performance.avg_delay > 0 && (
                    <p className="text-xs text-muted-foreground">
                      ~{analytics.order_metrics.performance.avg_delay}min behind ETA
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

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
              title="No Show Rate"
              value={analytics.waitlist_metrics.no_show_rate}
              unit="%"
              icon={AlertTriangle}
              color="text-red-500"
            />
            <MetricCard
              title="Peak Hour"
              value={`${analytics.waitlist_metrics.peak_hour}:00`}
              unit=""
              icon={TrendingUp}
              color="text-purple-500"
            />
          </div>

          {/* Waitlist Performance Breakdown - Three Brackets */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Performance Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Clock className="text-green-500" size={20} />
                    <span className="font-semibold text-green-600 dark:text-green-400">Early Tables</span>
                  </div>
                  <p className="text-3xl font-bold">{analytics.waitlist_metrics.performance.early_rate}%</p>
                  <p className="text-sm text-muted-foreground">
                    {analytics.waitlist_metrics.performance.early_count} tables
                  </p>
                  {analytics.waitlist_metrics.performance.avg_advance > 0 && (
                    <p className="text-xs text-muted-foreground">
                      ~{analytics.waitlist_metrics.performance.avg_advance}min ahead of ETA
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Clock className="text-blue-500" size={20} />
                    <span className="font-semibold text-blue-600 dark:text-blue-400">On Time Tables</span>
                  </div>
                  <p className="text-3xl font-bold">{analytics.waitlist_metrics.performance.on_time_rate}%</p>
                  <p className="text-sm text-muted-foreground">
                    {analytics.waitlist_metrics.performance.on_time_count} tables
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ±5 minutes of ETA
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Clock className="text-red-500" size={20} />
                    <span className="font-semibold text-red-600 dark:text-red-400">Late Tables</span>
                  </div>
                  <p className="text-3xl font-bold">{analytics.waitlist_metrics.performance.late_rate}%</p>
                  <p className="text-sm text-muted-foreground">
                    {analytics.waitlist_metrics.performance.late_count} tables
                  </p>
                  {analytics.waitlist_metrics.performance.avg_delay > 0 && (
                    <p className="text-xs text-muted-foreground">
                      ~{analytics.waitlist_metrics.performance.avg_delay}min behind ETA
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

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

        <TabsContent value="ratings" className="space-y-6">
          <RatingsView venueId={venue.id} />
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
                  <span>Orders On Time</span>
                  <Badge className={analytics.order_metrics.performance.on_time_rate >= 70 ? "bg-green-500" : "bg-amber-500"}>
                    {analytics.order_metrics.performance.on_time_rate}%
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Orders Late</span>
                  <Badge className={analytics.order_metrics.performance.late_rate <= 30 ? "bg-green-500" : "bg-red-500"}>
                    {analytics.order_metrics.performance.late_rate}%
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Tables On Time</span>
                  <Badge className={analytics.waitlist_metrics.performance.on_time_rate >= 70 ? "bg-green-500" : "bg-amber-500"}>
                    {analytics.waitlist_metrics.performance.on_time_rate}%
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Tables Late</span>
                  <Badge className={analytics.waitlist_metrics.performance.late_rate <= 30 ? "bg-green-500" : "bg-red-500"}>
                    {analytics.waitlist_metrics.performance.late_rate}%
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
                      className={`p-4 rounded-lg border space-y-2 ${
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
                        <strong>{insight.type === 'warning' ? '⚠️' : insight.type === 'info' ? 'ℹ️' : '✅'} {insight.category}:</strong> {insight.message}
                      </p>
                      {insight.action && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="w-full"
                        >
                          {insight.action}
                        </Button>
                      )}
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

        <TabsContent value="customer-insights">
          <CustomerInsights venueId={venue.id} />
        </TabsContent>

        <TabsContent value="operations">
          <OperationsEfficiency venueId={venue.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
};