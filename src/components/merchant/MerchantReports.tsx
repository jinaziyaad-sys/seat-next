import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, TrendingDown, Clock, Users, UtensilsCrossed, AlertTriangle } from "lucide-react";

export const MerchantReports = ({ venue }: { venue: string }) => {
  const [timeRange, setTimeRange] = useState("today");

  // Mock data for demo
  const orderMetrics = {
    totalOrders: 156,
    avgPrepTime: 12.5,
    readyToCollectLag: 3.2,
    noShowRate: 8.5,
    onTimeRate: 85.2
  };

  const waitlistMetrics = {
    totalWaitlist: 89,
    avgWaitTime: 18.5,
    actualVsQuoted: -2.1,
    noShowRate: 12.3,
    conversionRate: 87.7
  };

  const hourlyOrderData = [
    { hour: "09:00", orders: 12, avgTime: 8 },
    { hour: "10:00", orders: 18, avgTime: 10 },
    { hour: "11:00", orders: 25, avgTime: 12 },
    { hour: "12:00", orders: 45, avgTime: 15 },
    { hour: "13:00", orders: 52, avgTime: 18 },
    { hour: "14:00", orders: 38, avgTime: 14 },
    { hour: "15:00", orders: 28, avgTime: 11 },
    { hour: "16:00", orders: 22, avgTime: 9 },
    { hour: "17:00", orders: 35, avgTime: 13 },
    { hour: "18:00", orders: 48, avgTime: 16 },
    { hour: "19:00", orders: 42, avgTime: 14 },
    { hour: "20:00", orders: 28, avgTime: 12 }
  ];

  const waitTimeData = [
    { time: "09:00", quoted: 15, actual: 12 },
    { time: "10:00", quoted: 18, actual: 16 },
    { time: "11:00", quoted: 20, actual: 22 },
    { time: "12:00", quoted: 25, actual: 28 },
    { time: "13:00", quoted: 30, actual: 32 },
    { time: "14:00", quoted: 25, actual: 23 },
    { time: "15:00", quoted: 20, actual: 18 },
    { time: "16:00", quoted: 15, actual: 14 },
    { time: "17:00", quoted: 22, actual: 25 },
    { time: "18:00", quoted: 28, actual: 30 },
    { time: "19:00", quoted: 25, actual: 22 },
    { time: "20:00", quoted: 20, actual: 18 }
  ];

  const orderStatusData = [
    { name: "Collected", value: 78, color: "#22c55e" },
    { name: "In Progress", value: 14, color: "#eab308" },
    { name: "No Show", value: 8, color: "#ef4444" }
  ];

  const MetricCard = ({ title, value, unit, trend, icon: Icon, color = "text-primary" }: any) => (
    <Card className="shadow-card">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}{unit}</p>
            {trend && (
              <div className={`flex items-center gap-1 text-sm ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {trend > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {Math.abs(trend)}% vs yesterday
              </div>
            )}
          </div>
          <Icon size={32} className={color} />
        </div>
      </CardContent>
    </Card>
  );

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
          {/* Food Ready Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Total Orders"
              value={orderMetrics.totalOrders}
              unit=""
              trend={12}
              icon={UtensilsCrossed}
            />
            <MetricCard
              title="Avg Prep Time"
              value={orderMetrics.avgPrepTime}
              unit="m"
              trend={-3}
              icon={Clock}
              color="text-blue-500"
            />
            <MetricCard
              title="Collection Lag"
              value={orderMetrics.readyToCollectLag}
              unit="m"
              trend={-8}
              icon={Clock}
              color="text-green-500"
            />
            <MetricCard
              title="No Show Rate"
              value={orderMetrics.noShowRate}
              unit="%"
              trend={2}
              icon={AlertTriangle}
              color="text-red-500"
            />
          </div>

          {/* Hourly Orders Chart */}
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
            </CardContent>
          </Card>

          {/* Order Status Distribution */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Order Status Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col lg:flex-row items-center gap-8">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={orderStatusData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}%`}
                    >
                      {orderStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-3">
                  {orderStatusData.map((item) => (
                    <div key={item.name} className="flex items-center gap-3">
                      <div 
                        className="w-4 h-4 rounded" 
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-sm">{item.name}: {item.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="table-ready" className="space-y-6">
          {/* Table Ready Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Total Waitlist"
              value={waitlistMetrics.totalWaitlist}
              unit=""
              trend={8}
              icon={Users}
            />
            <MetricCard
              title="Avg Wait Time"
              value={waitlistMetrics.avgWaitTime}
              unit="m"
              trend={-5}
              icon={Clock}
              color="text-blue-500"
            />
            <MetricCard
              title="Quoted vs Actual"
              value={waitlistMetrics.actualVsQuoted}
              unit="m"
              trend={-12}
              icon={Clock}
              color="text-green-500"
            />
            <MetricCard
              title="No Show Rate"
              value={waitlistMetrics.noShowRate}
              unit="%"
              trend={3}
              icon={AlertTriangle}
              color="text-red-500"
            />
          </div>

          {/* Wait Time Accuracy Chart */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Quoted vs Actual Wait Times</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={waitTimeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="quoted" stroke="hsl(var(--primary))" name="Quoted" />
                  <Line type="monotone" dataKey="actual" stroke="hsl(var(--destructive))" name="Actual" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Today's Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Orders Processed</span>
                  <Badge variant="secondary">{orderMetrics.totalOrders}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Waitlist Entries</span>
                  <Badge variant="secondary">{waitlistMetrics.totalWaitlist}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>On-Time Performance</span>
                  <Badge className="bg-green-500 text-white">{orderMetrics.onTimeRate}%</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Customer Conversion</span>
                  <Badge className="bg-blue-500 text-white">{waitlistMetrics.conversionRate}%</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Performance Insights</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                  <p className="text-sm text-green-800 dark:text-green-200">
                    <strong>✓ Good:</strong> Collection lag decreased by 8% today
                  </p>
                </div>
                <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    <strong>→ Neutral:</strong> Wait time accuracy within 2 minutes
                  </p>
                </div>
                <div className="p-3 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    <strong>⚠ Watch:</strong> No-show rates increased during lunch
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};