import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users, Trophy, AlertTriangle } from "lucide-react";
import { SmartInsights } from "./SmartInsights";

interface StaffMemberMetrics {
  id: string;
  name: string;
  ordersHandled: number;
  avgPrepTime: number | null;
  onTimeRate: number | null;
  ordersPrepared: number;
  ordersMarkedReady: number;
}

interface StaffAnalyticsData {
  staff: StaffMemberMetrics[];
  totalOrders: number;
  unattributedCount: number;
  unattributedPercentage: number;
}

interface StaffPerformanceProps {
  venueId: string;
  startDate: Date;
  endDate: Date;
}

export const StaffPerformance = ({ venueId, startDate, endDate }: StaffPerformanceProps) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<StaffAnalyticsData | null>(null);

  useEffect(() => {
    fetchStaffAnalytics();
  }, [venueId, startDate, endDate]);

  const fetchStaffAnalytics = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: result, error } = await supabase.functions.invoke('get-venue-staff-analytics', {
        body: {
          venueId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;
      setData(result);
    } catch (error) {
      console.error("Error fetching staff analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-32">
          <div className="text-muted-foreground">Loading staff performance...</div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.staff.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Staff Performance
          </CardTitle>
          <CardDescription>No staff-attributed orders found for this period</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Staff performance data appears when orders are prepared or marked ready by logged-in staff members.
          </p>
        </CardContent>
      </Card>
    );
  }

  const topPerformer = data.staff[0];
  const fastestPrep = [...data.staff]
    .filter(s => s.avgPrepTime !== null)
    .sort((a, b) => (a.avgPrepTime ?? 999) - (b.avgPrepTime ?? 999))[0];

  // Build staff insights data
  const workloadDistribution = data.staff.map(s => ({
    name: s.name,
    percentage: data.totalOrders > 0 ? Math.round((s.ordersHandled / data.totalOrders) * 100) : 0,
  }));

  const maxWorkload = Math.max(...workloadDistribution.map(w => w.percentage));

  return (
    <div className="space-y-4">
      {/* Staff Smart Insights */}
      <SmartInsights
        data={{
          staffMetrics: {
            topPerformerName: topPerformer?.name,
            topPerformerOrders: topPerformer?.ordersHandled,
            fastestPrepName: fastestPrep?.name,
            fastestPrepTime: fastestPrep?.avgPrepTime ?? undefined,
            unattributedPercentage: data.unattributedPercentage,
            maxWorkloadPercentage: maxWorkload,
            maxWorkloadName: workloadDistribution.find(w => w.percentage === maxWorkload)?.name,
            staffCount: data.staff.length,
          },
        }}
        type="staff"
      />

      {/* Staff Metrics Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Staff Performance
          </CardTitle>
          <CardDescription>
            Per-staff breakdown for the selected period ({data.totalOrders} total orders, {data.unattributedCount} unattributed)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff Member</TableHead>
                <TableHead className="text-center">Orders Handled</TableHead>
                <TableHead className="text-center">Avg Prep Time</TableHead>
                <TableHead className="text-center">On-Time Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.staff.map((staff, index) => (
                <TableRow key={staff.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {staff.name}
                      {index === 0 && (
                        <Badge variant="default" className="text-xs">
                          <Trophy className="h-3 w-3 mr-1" />
                          Top
                        </Badge>
                      )}
                      {fastestPrep?.id === staff.id && index !== 0 && (
                        <Badge variant="secondary" className="text-xs">Fastest</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">{staff.ordersHandled}</TableCell>
                  <TableCell className="text-center">
                    {staff.avgPrepTime !== null ? `${staff.avgPrepTime} min` : '—'}
                  </TableCell>
                  <TableCell className="text-center">
                    {staff.onTimeRate !== null ? (
                      <span className={staff.onTimeRate >= 90 ? 'text-green-600' : staff.onTimeRate >= 75 ? 'text-yellow-600' : 'text-red-600'}>
                        {staff.onTimeRate}%
                      </span>
                    ) : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {data.unattributedPercentage > 20 && (
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              {data.unattributedPercentage}% of orders have no staff attribution — ensure staff are logged in when processing orders.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
