import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface MerchantExportProps {
  venueId: string;
  venueName: string;
}

export const MerchantExport = ({ venueId, venueName }: MerchantExportProps) => {
  const [exporting, setExporting] = useState(false);

  const exportToExcel = async () => {
    try {
      setExporting(true);
      toast.info("Generating export...");

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Not authenticated");
        return;
      }

      // Fetch all data in parallel
      const [customerInsights, efficiencyData, dailySnapshots] = await Promise.all([
        supabase.functions.invoke('get-venue-customer-insights', {
          body: { venue_id: venueId, time_range: '30days' },
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
        supabase.functions.invoke('get-venue-efficiency-analytics', {
          body: { venue_id: venueId, time_range: '30days' },
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
        supabase
          .from('daily_venue_snapshots')
          .select('*')
          .eq('venue_id', venueId)
          .order('snapshot_date', { ascending: false })
          .limit(90),
      ]);

      if (customerInsights.error) throw customerInsights.error;
      if (efficiencyData.error) throw efficiencyData.error;
      if (dailySnapshots.error) throw dailySnapshots.error;

      // Create workbook
      const wb = XLSX.utils.book_new();

      // Sheet 1: Customer Summary
      const customerSummary = customerInsights.data?.summary || {};
      const summaryData = [
        ['Metric', 'Value'],
        ['Total Customers', customerSummary.total_customers || 0],
        ['New Customers (30d)', customerSummary.new_customers || 0],
        ['Active Customers', customerSummary.active_customers || 0],
        ['Returning Customers', customerSummary.returning_customers || 0],
        ['Return Rate (%)', customerSummary.return_rate || 0],
        ['Avg Visit Frequency (days)', customerSummary.avg_visit_frequency_days || 0],
      ];
      const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, ws1, 'Customer Summary');

      // Sheet 2: Customer Segments
      const segments = customerInsights.data?.segments || {};
      const segmentData = [
        ['Segment', 'Count'],
        ['New', segments.new || 0],
        ['Active', segments.active || 0],
        ['Regular', segments.regular || 0],
        ['At Risk', segments.at_risk || 0],
        ['Inactive', segments.inactive || 0],
      ];
      const ws2 = XLSX.utils.aoa_to_sheet(segmentData);
      XLSX.utils.book_append_sheet(wb, ws2, 'Customer Segments');

      // Sheet 3: Top Customers (Anonymized)
      const topCustomers = customerInsights.data?.top_loyal_customers || [];
      const customerHeaders = ['Customer ID', 'Total Orders', 'Waitlist Joins', 'Total Activity', 'Days Since Visit'];
      const customerRows = topCustomers.map((c: any) => [
        c.customer_id,
        c.total_orders,
        c.total_waitlist_joins,
        c.total_activity,
        c.days_since_last_visit || 0,
      ]);
      const ws3 = XLSX.utils.aoa_to_sheet([customerHeaders, ...customerRows]);
      XLSX.utils.book_append_sheet(wb, ws3, 'Top Customers');

      // Sheet 4: Operations Summary
      const opsSummary = efficiencyData.data?.summary || {};
      const opsData = [
        ['Metric', 'Value'],
        ['Avg Prep Time (min)', opsSummary.avg_prep_time || 0],
        ['On-Time Rate (%)', opsSummary.on_time_rate || 0],
        ['Avg Wait Time (min)', opsSummary.avg_wait_time || 0],
        ['Total Orders', opsSummary.total_orders || 0],
        ['Total Waitlist', opsSummary.total_waitlist || 0],
      ];
      const ws4 = XLSX.utils.aoa_to_sheet(opsData);
      XLSX.utils.book_append_sheet(wb, ws4, 'Operations Summary');

      // Sheet 5: Staff Performance
      const staffPerf = efficiencyData.data?.staff_performance || [];
      const staffHeaders = ['Staff ID', 'Orders Completed', 'Avg Prep Time (min)'];
      const staffRows = staffPerf.map((s: any) => [
        s.name || s.staff_id,
        s.orders_completed,
        s.avg_prep_time || 0,
      ]);
      const ws5 = XLSX.utils.aoa_to_sheet([staffHeaders, ...staffRows]);
      XLSX.utils.book_append_sheet(wb, ws5, 'Staff Performance');

      // Sheet 6: Peak Hours
      const peakHours = efficiencyData.data?.peak_hours || [];
      const peakHeaders = ['Hour', 'Order Count'];
      const peakRows = peakHours.map((p: any) => [
        `${p.hour}:00`,
        p.count,
      ]);
      const ws6 = XLSX.utils.aoa_to_sheet([peakHeaders, ...peakRows]);
      XLSX.utils.book_append_sheet(wb, ws6, 'Peak Hours');

      // Sheet 7: Daily Snapshots
      const snapshots = dailySnapshots.data || [];
      if (snapshots.length > 0) {
        const snapshotHeaders = [
          'Date',
          'Total Orders',
          'Completed Orders',
          'Total Customers',
          'New Customers',
          'Returning Customers',
          'Avg Rating',
          'Avg Prep Time (min)',
          'On-Time %',
          'Total Waitlist',
          'Avg Wait Time (min)',
        ];
        const snapshotRows = snapshots.map((s: any) => [
          s.snapshot_date,
          s.total_orders,
          s.completed_orders,
          s.total_customers,
          s.new_customers,
          s.returning_customers,
          s.avg_rating || '-',
          s.avg_prep_time_minutes || '-',
          s.on_time_percentage || '-',
          s.total_waitlist_joins,
          s.avg_wait_time_minutes || '-',
        ]);
        const ws7 = XLSX.utils.aoa_to_sheet([snapshotHeaders, ...snapshotRows]);
        XLSX.utils.book_append_sheet(wb, ws7, 'Daily Snapshots');
      }

      // Generate file
      const fileName = `${venueName.replace(/\s+/g, '_')}_Analytics_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast.success("Export complete!");
    } catch (error: any) {
      console.error("Export error:", error);
      toast.error(error.message || "Failed to export data");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Export Analytics
        </CardTitle>
        <CardDescription>
          Download comprehensive analytics report including customer insights, operations data, and daily snapshots
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          onClick={exportToExcel}
          disabled={exporting}
          className="w-full sm:w-auto"
        >
          <Download className="mr-2 h-4 w-4" />
          {exporting ? "Generating..." : "Export to Excel"}
        </Button>
      </CardContent>
    </Card>
  );
};
