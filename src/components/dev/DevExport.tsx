import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Download, FileSpreadsheet, FileText, Building2 } from "lucide-react";
import { toast } from "sonner";
import { startOfDay, subDays, endOfDay, startOfToday, format } from "date-fns";
import { DateRangePicker } from "../merchant/DateRangePicker";
import * as XLSX from "xlsx";

interface Venue {
  id: string;
  name: string;
  created_at: string;
}

export function DevExport() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [selectedVenueId, setSelectedVenueId] = useState<string>("all");
  const [exporting, setExporting] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const today = startOfToday();
  const [startDate, setStartDate] = useState<Date>(startOfDay(subDays(today, 30)));
  const [endDate, setEndDate] = useState<Date>(endOfDay(today));

  useEffect(() => {
    fetchVenues();
  }, []);

  const fetchVenues = async () => {
    const { data } = await supabase
      .from("venues")
      .select("id, name, created_at")
      .order("name");
    if (data) setVenues(data);
  };

  const handleDateChange = (start: Date, end: Date) => {
    setStartDate(start);
    setEndDate(end);
  };

  const getSelectedVenue = () => {
    if (selectedVenueId === "all") return null;
    return venues.find(v => v.id === selectedVenueId);
  };

  const exportSingleVenue = async (venueId: string, venueName: string) => {
    const queryStartDate = startDate.toISOString();
    const queryEndDate = endDate.toISOString();

    // Fetch all data for this venue with date filtering
    const [
      ordersData,
      orderAnalyticsData,
      waitlistData,
      waitlistAnalyticsData,
      ratingsData,
      waitlistRatingsData,
      snapshotsData,
      staffData
    ] = await Promise.all([
      supabase
        .from("orders")
        .select("*")
        .eq("venue_id", venueId)
        .gte("created_at", queryStartDate)
        .lte("created_at", queryEndDate)
        .order("created_at", { ascending: false }),
      supabase
        .from("order_analytics")
        .select("*")
        .eq("venue_id", venueId)
        .gte("placed_at", queryStartDate)
        .lte("placed_at", queryEndDate)
        .order("placed_at", { ascending: false }),
      supabase
        .from("waitlist_entries")
        .select("*")
        .eq("venue_id", venueId)
        .gte("created_at", queryStartDate)
        .lte("created_at", queryEndDate)
        .order("created_at", { ascending: false }),
      supabase
        .from("waitlist_analytics")
        .select("*")
        .eq("venue_id", venueId)
        .gte("joined_at", queryStartDate)
        .lte("joined_at", queryEndDate)
        .order("joined_at", { ascending: false }),
      supabase
        .from("order_ratings")
        .select("*")
        .eq("venue_id", venueId)
        .gte("created_at", queryStartDate)
        .lte("created_at", queryEndDate)
        .order("created_at", { ascending: false }),
      supabase
        .from("waitlist_ratings")
        .select("*")
        .eq("venue_id", venueId)
        .gte("created_at", queryStartDate)
        .lte("created_at", queryEndDate)
        .order("created_at", { ascending: false }),
      supabase
        .from("daily_venue_snapshots")
        .select("*")
        .eq("venue_id", venueId)
        .gte("snapshot_date", queryStartDate.split("T")[0])
        .lte("snapshot_date", queryEndDate.split("T")[0])
        .order("snapshot_date", { ascending: false }),
      supabase
        .from("user_roles")
        .select("user_id, role")
        .eq("venue_id", venueId),
    ]);

    // Create workbook
    const wb = XLSX.utils.book_new();

    // Sheet 1: Summary
    const summaryData = [
      ["Venue Name", venueName],
      ["Date Range", `${format(startDate, "yyyy-MM-dd")} to ${format(endDate, "yyyy-MM-dd")}`],
      ["Total Orders", ordersData.data?.length || 0],
      ["Total Waitlist Entries", waitlistData.data?.length || 0],
      ["Total Order Ratings", ratingsData.data?.length || 0],
      ["Total Waitlist Ratings", waitlistRatingsData.data?.length || 0],
      ["Staff Members", staffData.data?.length || 0],
    ];
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");

    // Sheet 2: Orders
    if (ordersData.data && ordersData.data.length > 0) {
      const ordersSheet = XLSX.utils.json_to_sheet(
        ordersData.data.map((o) => ({
          "Order Number": o.order_number,
          Customer: o.customer_name || "Anonymous",
          Phone: o.customer_phone || "",
          Status: o.status,
          Items: JSON.stringify(o.items),
          ETA: o.eta ? new Date(o.eta).toLocaleString() : "-",
          Notes: o.notes || "",
          Created: new Date(o.created_at).toLocaleString(),
        }))
      );
      XLSX.utils.book_append_sheet(wb, ordersSheet, "Orders");
    }

    // Sheet 3: Order Analytics
    if (orderAnalyticsData.data && orderAnalyticsData.data.length > 0) {
      const analyticsSheet = XLSX.utils.json_to_sheet(
        orderAnalyticsData.data.map((o) => ({
          "Placed At": new Date(o.placed_at).toLocaleString(),
          "Quoted Prep (min)": o.quoted_prep_time,
          "Actual Prep (min)": o.actual_prep_time || "-",
          "Items Count": o.items_count,
          Hour: o.hour_of_day,
          "Day of Week": o.day_of_week,
          "Delay Reason": o.delay_reason || "",
        }))
      );
      XLSX.utils.book_append_sheet(wb, analyticsSheet, "Order Analytics");
    }

    // Sheet 4: Waitlist Entries
    if (waitlistData.data && waitlistData.data.length > 0) {
      const waitlistSheet = XLSX.utils.json_to_sheet(
        waitlistData.data.map((w) => ({
          Customer: w.customer_name,
          Phone: w.customer_phone || "",
          "Party Size": w.party_size,
          Status: w.status,
          ETA: w.eta ? new Date(w.eta).toLocaleString() : "-",
          Preferences: w.preferences?.join(", ") || "",
          Notes: w.notes || "",
          Created: new Date(w.created_at).toLocaleString(),
        }))
      );
      XLSX.utils.book_append_sheet(wb, waitlistSheet, "Waitlist");
    }

    // Sheet 5: Waitlist Analytics
    if (waitlistAnalyticsData.data && waitlistAnalyticsData.data.length > 0) {
      const waitlistAnalyticsSheet = XLSX.utils.json_to_sheet(
        waitlistAnalyticsData.data.map((w) => ({
          "Joined At": new Date(w.joined_at).toLocaleString(),
          "Party Size": w.party_size,
          "Quoted Wait (min)": w.quoted_wait_time,
          "Actual Wait (min)": w.actual_wait_time || "-",
          "No Show": w.was_no_show ? "Yes" : "No",
          Hour: w.hour_of_day,
          "Day of Week": w.day_of_week,
        }))
      );
      XLSX.utils.book_append_sheet(wb, waitlistAnalyticsSheet, "Waitlist Analytics");
    }

    // Sheet 6: Order Ratings
    if (ratingsData.data && ratingsData.data.length > 0) {
      const ratingsSheet = XLSX.utils.json_to_sheet(
        ratingsData.data.map((r) => ({
          Rating: r.rating,
          Feedback: r.feedback_text || "",
          Created: new Date(r.created_at).toLocaleString(),
        }))
      );
      XLSX.utils.book_append_sheet(wb, ratingsSheet, "Order Ratings");
    }

    // Sheet 7: Waitlist Ratings
    if (waitlistRatingsData.data && waitlistRatingsData.data.length > 0) {
      const waitlistRatingsSheet = XLSX.utils.json_to_sheet(
        waitlistRatingsData.data.map((r) => ({
          Rating: r.rating,
          Feedback: r.feedback_text || "",
          Created: new Date(r.created_at).toLocaleString(),
        }))
      );
      XLSX.utils.book_append_sheet(wb, waitlistRatingsSheet, "Waitlist Ratings");
    }

    // Sheet 8: Daily Snapshots
    if (snapshotsData.data && snapshotsData.data.length > 0) {
      const snapshotsSheet = XLSX.utils.json_to_sheet(
        snapshotsData.data.map((s) => ({
          Date: s.snapshot_date,
          "Total Orders": s.total_orders,
          "Completed Orders": s.completed_orders,
          "Total Customers": s.total_customers,
          "New Customers": s.new_customers,
          "Returning Customers": s.returning_customers,
          "Avg Rating": s.avg_rating || "-",
          "Avg Prep Time (min)": s.avg_prep_time_minutes || "-",
          "On-Time %": s.on_time_percentage || "-",
          "Total Waitlist Joins": s.total_waitlist_joins,
          "Avg Wait Time (min)": s.avg_wait_time_minutes || "-",
        }))
      );
      XLSX.utils.book_append_sheet(wb, snapshotsSheet, "Daily Snapshots");
    }

    // Sheet 9: Staff
    if (staffData.data && staffData.data.length > 0) {
      const staffSheet = XLSX.utils.json_to_sheet(
        staffData.data.map((s) => ({
          "User ID": s.user_id,
          Role: s.role,
        }))
      );
      XLSX.utils.book_append_sheet(wb, staffSheet, "Staff");
    }

    // Generate filename with date range
    const startStr = format(startDate, "yyyy-MM-dd");
    const endStr = format(endDate, "yyyy-MM-dd");
    const sanitizedName = venueName.replace(/[^a-zA-Z0-9]/g, "_");
    const fileName = `${sanitizedName}_${startStr}_to_${endStr}.xlsx`;

    XLSX.writeFile(wb, fileName);
    return fileName;
  };

  const exportPlatformSummary = async () => {
    const queryStartDate = startDate.toISOString();
    const queryEndDate = endDate.toISOString();

    // Create a platform summary workbook
    const wb = XLSX.utils.book_new();

    // Sheet 1: All Venues Summary
    const { data: allVenues } = await supabase
      .from("venues")
      .select("*")
      .order("name");

    if (allVenues && allVenues.length > 0) {
      const venuesSummary = XLSX.utils.json_to_sheet(
        allVenues.map((v) => ({
          "Venue Name": v.name,
          Address: v.address || "N/A",
          "Display Address": v.display_address || "N/A",
          Phone: v.phone || "N/A",
          "Service Types": v.service_types?.join(", ") || "N/A",
          "Created At": new Date(v.created_at).toLocaleString(),
        }))
      );
      XLSX.utils.book_append_sheet(wb, venuesSummary, "All Venues");
    }

    // Aggregate data across all venues for the date range
    const [ordersData, waitlistData, ratingsData, snapshotsData] = await Promise.all([
      supabase
        .from("orders")
        .select("venue_id, status")
        .gte("created_at", queryStartDate)
        .lte("created_at", queryEndDate),
      supabase
        .from("waitlist_entries")
        .select("venue_id, status")
        .gte("created_at", queryStartDate)
        .lte("created_at", queryEndDate),
      supabase
        .from("order_ratings")
        .select("venue_id, rating")
        .gte("created_at", queryStartDate)
        .lte("created_at", queryEndDate),
      supabase
        .from("daily_venue_snapshots")
        .select("*")
        .gte("snapshot_date", queryStartDate.split("T")[0])
        .lte("snapshot_date", queryEndDate.split("T")[0]),
    ]);

    // Sheet 2: Per-Venue Metrics
    if (allVenues && allVenues.length > 0) {
      const venueMetrics = allVenues.map((venue) => {
        const venueOrders = ordersData.data?.filter((o) => o.venue_id === venue.id) || [];
        const venueWaitlist = waitlistData.data?.filter((w) => w.venue_id === venue.id) || [];
        const venueRatings = ratingsData.data?.filter((r) => r.venue_id === venue.id) || [];
        const avgRating =
          venueRatings.length > 0
            ? (venueRatings.reduce((sum, r) => sum + r.rating, 0) / venueRatings.length).toFixed(2)
            : "N/A";

        return {
          "Venue Name": venue.name,
          "Total Orders": venueOrders.length,
          "Completed Orders": venueOrders.filter((o) => o.status === "collected").length,
          "Total Waitlist": venueWaitlist.length,
          "Seated Customers": venueWaitlist.filter((w) => w.status === "seated").length,
          "Total Ratings": venueRatings.length,
          "Avg Rating": avgRating,
        };
      });

      const metricsSheet = XLSX.utils.json_to_sheet(venueMetrics);
      XLSX.utils.book_append_sheet(wb, metricsSheet, "Venue Metrics");
    }

    // Sheet 3: Platform Totals
    const platformTotals = [
      ["Metric", "Value"],
      ["Date Range", `${format(startDate, "yyyy-MM-dd")} to ${format(endDate, "yyyy-MM-dd")}`],
      ["Total Venues", allVenues?.length || 0],
      ["Total Orders", ordersData.data?.length || 0],
      ["Completed Orders", ordersData.data?.filter((o) => o.status === "collected").length || 0],
      ["Total Waitlist Entries", waitlistData.data?.length || 0],
      ["Seated Customers", waitlistData.data?.filter((w) => w.status === "seated").length || 0],
      ["Total Ratings", ratingsData.data?.length || 0],
      [
        "Platform Avg Rating",
        ratingsData.data && ratingsData.data.length > 0
          ? (ratingsData.data.reduce((sum, r) => sum + r.rating, 0) / ratingsData.data.length).toFixed(2)
          : "N/A",
      ],
    ];
    const totalsSheet = XLSX.utils.aoa_to_sheet(platformTotals);
    XLSX.utils.book_append_sheet(wb, totalsSheet, "Platform Summary");

    // Sheet 4: Aggregated Daily Snapshots
    if (snapshotsData.data && snapshotsData.data.length > 0) {
      // Group by date and aggregate
      const dateMap = new Map<string, any>();
      snapshotsData.data.forEach((s) => {
        const existing = dateMap.get(s.snapshot_date) || {
          date: s.snapshot_date,
          total_orders: 0,
          completed_orders: 0,
          total_customers: 0,
          new_customers: 0,
          total_waitlist: 0,
          rating_sum: 0,
          rating_count: 0,
        };
        existing.total_orders += s.total_orders || 0;
        existing.completed_orders += s.completed_orders || 0;
        existing.total_customers += s.total_customers || 0;
        existing.new_customers += s.new_customers || 0;
        existing.total_waitlist += s.total_waitlist_joins || 0;
        if (s.avg_rating) {
          existing.rating_sum += s.avg_rating;
          existing.rating_count += 1;
        }
        dateMap.set(s.snapshot_date, existing);
      });

      const aggregatedSnapshots = Array.from(dateMap.values())
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((s) => ({
          Date: s.date,
          "Total Orders": s.total_orders,
          "Completed Orders": s.completed_orders,
          "Total Customers": s.total_customers,
          "New Customers": s.new_customers,
          "Total Waitlist Joins": s.total_waitlist,
          "Avg Rating": s.rating_count > 0 ? (s.rating_sum / s.rating_count).toFixed(2) : "-",
        }));

      const snapshotsSheet = XLSX.utils.json_to_sheet(aggregatedSnapshots);
      XLSX.utils.book_append_sheet(wb, snapshotsSheet, "Daily Aggregates");
    }

    // Generate filename
    const startStr = format(startDate, "yyyy-MM-dd");
    const endStr = format(endDate, "yyyy-MM-dd");
    const fileName = `Platform_Summary_${startStr}_to_${endStr}.xlsx`;

    XLSX.writeFile(wb, fileName);
    return fileName;
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      toast.info("Generating Excel export...");

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Not authenticated");
        return;
      }

      let fileName: string;
      if (selectedVenueId === "all") {
        fileName = await exportPlatformSummary();
        toast.success(`Exported platform summary: ${fileName}`);
      } else {
        const venue = getSelectedVenue();
        if (!venue) {
          toast.error("Venue not found");
          return;
        }
        fileName = await exportSingleVenue(venue.id, venue.name);
        toast.success(`Exported ${venue.name}: ${fileName}`);
      }
    } catch (error: any) {
      console.error("Export error:", error);
      toast.error(error.message || "Failed to export data");
    } finally {
      setExporting(false);
    }
  };

  const handleExportCsv = async () => {
    setExportingCsv(true);
    try {
      toast.info("Generating CSV export...");

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Not authenticated");
        return;
      }

      const queryStartDate = startDate.toISOString();
      const queryEndDate = endDate.toISOString();

      if (selectedVenueId === "all") {
        // Export all orders as CSV
        const { data: ordersData } = await supabase
          .from("orders")
          .select("order_number, customer_name, status, items, eta, notes, created_at, venue_id")
          .gte("created_at", queryStartDate)
          .lte("created_at", queryEndDate)
          .order("created_at", { ascending: false });

        if (ordersData && ordersData.length > 0) {
          const venueMap = new Map(venues.map((v) => [v.id, v.name]));
          const ordersCsv = ordersData.map((o) => ({
            venue: venueMap.get(o.venue_id) || "Unknown",
            order_number: o.order_number,
            customer: o.customer_name || "Anonymous",
            status: o.status,
            items: JSON.stringify(o.items),
            eta: o.eta || "",
            notes: o.notes || "",
            created_at: o.created_at,
          }));
          const ws = XLSX.utils.json_to_sheet(ordersCsv);
          const csv = XLSX.utils.sheet_to_csv(ws);
          downloadCsv(csv, `Platform_Orders_${format(startDate, "yyyy-MM-dd")}_to_${format(endDate, "yyyy-MM-dd")}.csv`);
        }

        toast.success("CSV export complete!");
      } else {
        const venue = getSelectedVenue();
        if (!venue) {
          toast.error("Venue not found");
          return;
        }

        // Export single venue orders and waitlist as CSV
        const [ordersData, waitlistData] = await Promise.all([
          supabase
            .from("orders")
            .select("order_number, customer_name, status, items, eta, notes, created_at")
            .eq("venue_id", venue.id)
            .gte("created_at", queryStartDate)
            .lte("created_at", queryEndDate)
            .order("created_at", { ascending: false }),
          supabase
            .from("waitlist_entries")
            .select("customer_name, party_size, status, eta, notes, created_at")
            .eq("venue_id", venue.id)
            .gte("created_at", queryStartDate)
            .lte("created_at", queryEndDate)
            .order("created_at", { ascending: false }),
        ]);

        const startStr = format(startDate, "yyyy-MM-dd");
        const endStr = format(endDate, "yyyy-MM-dd");
        const sanitizedName = venue.name.replace(/[^a-zA-Z0-9]/g, "_");

        if (ordersData.data && ordersData.data.length > 0) {
          const ordersCsv = ordersData.data.map((o) => ({
            order_number: o.order_number,
            customer: o.customer_name || "Anonymous",
            status: o.status,
            items: JSON.stringify(o.items),
            eta: o.eta || "",
            notes: o.notes || "",
            created_at: o.created_at,
          }));
          const ws = XLSX.utils.json_to_sheet(ordersCsv);
          const csv = XLSX.utils.sheet_to_csv(ws);
          downloadCsv(csv, `${sanitizedName}_Orders_${startStr}_to_${endStr}.csv`);
        }

        if (waitlistData.data && waitlistData.data.length > 0) {
          const waitlistCsv = waitlistData.data.map((w) => ({
            customer: w.customer_name,
            party_size: w.party_size,
            status: w.status,
            eta: w.eta || "",
            notes: w.notes || "",
            created_at: w.created_at,
          }));
          const ws = XLSX.utils.json_to_sheet(waitlistCsv);
          const csv = XLSX.utils.sheet_to_csv(ws);
          downloadCsv(csv, `${sanitizedName}_Waitlist_${startStr}_to_${endStr}.csv`);
        }

        toast.success("CSV export complete!");
      }
    } catch (error: any) {
      console.error("CSV export error:", error);
      toast.error(error.message || "Failed to export CSV");
    } finally {
      setExportingCsv(false);
    }
  };

  const downloadCsv = (csvContent: string, filename: string) => {
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  };

  // Get the earliest venue creation date for the date picker
  const earliestVenueDate = venues.length > 0
    ? venues.reduce((earliest, venue) => {
        const venueDate = new Date(venue.created_at);
        return venueDate < earliest ? venueDate : earliest;
      }, new Date(venues[0].created_at))
    : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Export Platform Data
        </CardTitle>
        <CardDescription>
          Export analytics data for a specific venue or the entire platform with date range filtering
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Venue Selection */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Select Venue
          </Label>
          <Select value={selectedVenueId} onValueChange={setSelectedVenueId}>
            <SelectTrigger className="w-full sm:w-[300px]">
              <SelectValue placeholder="Select a venue" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Venues (Platform Summary)</SelectItem>
              {venues.map((venue) => (
                <SelectItem key={venue.id} value={venue.id}>
                  {venue.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date Range Selection */}
        <div className="space-y-2">
          <Label>Date Range</Label>
          <DateRangePicker
            venueCreatedAt={earliestVenueDate}
            startDate={startDate}
            endDate={endDate}
            onDateChange={handleDateChange}
          />
        </div>

        {/* Export Buttons */}
        <div className="flex flex-wrap gap-2 pt-2">
          <Button onClick={handleExportExcel} disabled={exporting}>
            <Download className="mr-2 h-4 w-4" />
            {exporting ? "Generating..." : "Export to Excel"}
          </Button>
          <Button variant="outline" onClick={handleExportCsv} disabled={exportingCsv}>
            <FileText className="mr-2 h-4 w-4" />
            {exportingCsv ? "Generating..." : "Export to CSV"}
          </Button>
        </div>

        {/* Info text */}
        <p className="text-xs text-muted-foreground">
          {selectedVenueId === "all"
            ? "Excel export includes venue list, per-venue metrics, and platform totals. CSV exports orders only."
            : "Excel export includes orders, waitlist, ratings, daily snapshots, and staff. CSV exports orders and waitlist separately."}
        </p>
      </CardContent>
    </Card>
  );
}
