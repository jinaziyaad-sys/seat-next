import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";
import { startOfDay, subDays, endOfDay, startOfToday, format } from "date-fns";
import { DateRangePicker } from "./DateRangePicker";
import * as XLSX from "xlsx";

interface MerchantExportProps {
  venueId: string;
  venueName: string;
  venueCreatedAt?: string;
}

export const MerchantExport = ({ venueId, venueName, venueCreatedAt }: MerchantExportProps) => {
  const [exporting, setExporting] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const today = startOfToday();
  const [startDate, setStartDate] = useState<Date>(startOfDay(subDays(today, 30)));
  const [endDate, setEndDate] = useState<Date>(endOfDay(today));
  const [exportAll, setExportAll] = useState(false);

  const handleDateChange = (start: Date, end: Date) => {
    setStartDate(start);
    setEndDate(end);
    setExportAll(false);
  };

  const handleExportAll = () => {
    if (venueCreatedAt) {
      setStartDate(startOfDay(new Date(venueCreatedAt)));
      setEndDate(endOfDay(today));
      setExportAll(true);
    }
  };

  const exportToExcel = async () => {
    try {
      setExporting(true);
      toast.info("Generating Excel export...");

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Not authenticated");
        return;
      }

      // Use the selected date range
      const queryStartDate = startDate.toISOString();
      const queryEndDate = endDate.toISOString();

      // Fetch all data in parallel using selected date range
      const [customerInsights, efficiencyData, dailySnapshots, ordersData, waitlistData, ratingsData] = await Promise.all([
        supabase.functions.invoke('get-venue-customer-insights', {
          body: { venue_id: venueId, start_date: queryStartDate, end_date: queryEndDate },
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
        supabase.functions.invoke('get-venue-efficiency-analytics', {
          body: { venue_id: venueId, start_date: queryStartDate, end_date: queryEndDate },
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
        supabase
          .from('daily_venue_snapshots')
          .select('*')
          .eq('venue_id', venueId)
          .gte('snapshot_date', queryStartDate.split('T')[0])
          .lte('snapshot_date', queryEndDate.split('T')[0])
          .order('snapshot_date', { ascending: false }),
        supabase
          .from('orders')
          .select('*')
          .eq('venue_id', venueId)
          .gte('created_at', queryStartDate)
          .lte('created_at', queryEndDate)
          .order('created_at', { ascending: false }),
        supabase
          .from('waitlist_entries')
          .select('*')
          .eq('venue_id', venueId)
          .gte('created_at', queryStartDate)
          .lte('created_at', queryEndDate)
          .order('created_at', { ascending: false }),
        supabase
          .from('order_ratings')
          .select('*')
          .eq('venue_id', venueId)
          .gte('created_at', queryStartDate)
          .lte('created_at', queryEndDate)
          .order('created_at', { ascending: false }),
      ]);

      if (customerInsights.error) console.error('Customer insights error:', customerInsights.error);
      if (efficiencyData.error) console.error('Efficiency data error:', efficiencyData.error);
      if (dailySnapshots.error) console.error('Daily snapshots error:', dailySnapshots.error);
      // Don't throw on missing data - some sheets may just be empty

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

      // Sheet 8: Raw Orders
      if (ordersData.data && ordersData.data.length > 0) {
        const ordersSheet = XLSX.utils.json_to_sheet(ordersData.data.map((o: any) => ({
          'Order Number': o.order_number,
          'Customer': o.customer_name || 'Anonymous',
          'Status': o.status,
          'Items': JSON.stringify(o.items),
          'ETA': o.eta ? new Date(o.eta).toLocaleString() : '-',
          'Notes': o.notes || '',
          'Created': new Date(o.created_at).toLocaleString(),
        })));
        XLSX.utils.book_append_sheet(wb, ordersSheet, 'Orders');
      }

      // Sheet 9: Raw Waitlist
      if (waitlistData.data && waitlistData.data.length > 0) {
        const waitlistSheet = XLSX.utils.json_to_sheet(waitlistData.data.map((w: any) => ({
          'Customer': w.customer_name,
          'Party Size': w.party_size,
          'Status': w.status,
          'ETA': w.eta ? new Date(w.eta).toLocaleString() : '-',
          'Notes': w.notes || '',
          'Preferences': w.preferences?.join(', ') || '',
          'Created': new Date(w.created_at).toLocaleString(),
        })));
        XLSX.utils.book_append_sheet(wb, waitlistSheet, 'Waitlist');
      }

      // Sheet 10: Ratings
      if (ratingsData.data && ratingsData.data.length > 0) {
        const ratingsSheet = XLSX.utils.json_to_sheet(ratingsData.data.map((r: any) => ({
          'Rating': r.rating,
          'Feedback': r.feedback_text || '',
          'Created': new Date(r.created_at).toLocaleString(),
        })));
        XLSX.utils.book_append_sheet(wb, ratingsSheet, 'Ratings');
      }

      // Generate file with date range in filename
      const startStr = format(startDate, 'yyyy-MM-dd');
      const endStr = format(endDate, 'yyyy-MM-dd');
      const fileName = `${venueName.replace(/\s+/g, '_')}_${startStr}_to_${endStr}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast.success("Excel export complete!");
    } catch (error: any) {
      console.error("Export error:", error);
      toast.error(error.message || "Failed to export data");
    } finally {
      setExporting(false);
    }
  };

  // CSV export function for simpler data
  const exportToCsv = async () => {
    try {
      setExportingCsv(true);
      toast.info("Generating CSV export...");

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Not authenticated");
        return;
      }

      const queryStartDate = startDate.toISOString();
      const queryEndDate = endDate.toISOString();

      // Fetch orders and waitlist for CSV
      const [ordersData, waitlistData] = await Promise.all([
        supabase
          .from('orders')
          .select('order_number, customer_name, status, items, eta, notes, created_at')
          .eq('venue_id', venueId)
          .gte('created_at', queryStartDate)
          .lte('created_at', queryEndDate)
          .order('created_at', { ascending: false }),
        supabase
          .from('waitlist_entries')
          .select('customer_name, party_size, status, eta, notes, created_at')
          .eq('venue_id', venueId)
          .gte('created_at', queryStartDate)
          .lte('created_at', queryEndDate)
          .order('created_at', { ascending: false }),
      ]);

      const startStr = format(startDate, 'yyyy-MM-dd');
      const endStr = format(endDate, 'yyyy-MM-dd');

      // Export orders CSV
      if (ordersData.data && ordersData.data.length > 0) {
        const ordersCsv = ordersData.data.map((o: any) => ({
          order_number: o.order_number,
          customer: o.customer_name || 'Anonymous',
          status: o.status,
          items: JSON.stringify(o.items),
          eta: o.eta || '',
          notes: o.notes || '',
          created_at: o.created_at,
        }));
        const ws = XLSX.utils.json_to_sheet(ordersCsv);
        const csv = XLSX.utils.sheet_to_csv(ws);
        downloadCsv(csv, `${venueName.replace(/\s+/g, '_')}_Orders_${startStr}_to_${endStr}.csv`);
      }

      // Export waitlist CSV
      if (waitlistData.data && waitlistData.data.length > 0) {
        const waitlistCsv = waitlistData.data.map((w: any) => ({
          customer: w.customer_name,
          party_size: w.party_size,
          status: w.status,
          eta: w.eta || '',
          notes: w.notes || '',
          created_at: w.created_at,
        }));
        const ws = XLSX.utils.json_to_sheet(waitlistCsv);
        const csv = XLSX.utils.sheet_to_csv(ws);
        downloadCsv(csv, `${venueName.replace(/\s+/g, '_')}_Waitlist_${startStr}_to_${endStr}.csv`);
      }

      toast.success("CSV export complete!");
    } catch (error: any) {
      console.error("CSV export error:", error);
      toast.error(error.message || "Failed to export CSV");
    } finally {
      setExportingCsv(false);
    }
  };

  const downloadCsv = (csvContent: string, filename: string) => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Export Analytics
        </CardTitle>
        <CardDescription>
          Download comprehensive analytics report including customer insights, operations data, orders, waitlist, and ratings
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Date Range Selection */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <DateRangePicker
            venueCreatedAt={venueCreatedAt}
            startDate={startDate}
            endDate={endDate}
            onDateChange={handleDateChange}
          />
          {venueCreatedAt && (
            <Button
              variant={exportAll ? "default" : "outline"}
              size="sm"
              onClick={handleExportAll}
            >
              Export All History
            </Button>
          )}
        </div>

        {/* Export Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={exportToExcel}
            disabled={exporting}
          >
            <Download className="mr-2 h-4 w-4" />
            {exporting ? "Generating Excel..." : "Export to Excel"}
          </Button>
          <Button
            variant="outline"
            onClick={exportToCsv}
            disabled={exportingCsv}
          >
            <FileText className="mr-2 h-4 w-4" />
            {exportingCsv ? "Generating CSV..." : "Export to CSV"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
