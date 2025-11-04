import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, Search, Users, Activity, ShoppingBag, Clock } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface PatronData {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  email_verified: boolean;
  phone_verified: boolean;
  has_push_enabled: boolean;
  created_at: string;
  days_since_signup: number;
  last_activity_date: string | null;
  days_since_last_activity: number | null;
  total_orders: number;
  total_waitlist_joins: number;
  preferred_venue_id: string | null;
  preferred_venue_name: string | null;
  account_status: "active" | "inactive";
}

interface PatronSummary {
  total_patrons: number;
  active_patrons: number;
  inactive_patrons: number;
  total_orders: number;
  total_waitlist_joins: number;
  avg_orders_per_patron: number;
}

export const PatronManagement = () => {
  const [patrons, setPatrons] = useState<PatronData[]>([]);
  const [filteredPatrons, setFilteredPatrons] = useState<PatronData[]>([]);
  const [summary, setSummary] = useState<PatronSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [verificationFilter, setVerificationFilter] = useState<string>("all");

  useEffect(() => {
    fetchPatronData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [patrons, searchTerm, statusFilter, verificationFilter]);

  const fetchPatronData = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error("Not authenticated");
        return;
      }

      const { data, error } = await supabase.functions.invoke('get-platform-patron-data', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      setPatrons(data.patrons);
      setSummary(data.summary);
      toast.success("Patron data loaded");
    } catch (error: any) {
      console.error("Error fetching patron data:", error);
      toast.error(error.message || "Failed to load patron data");
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...patrons];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.full_name.toLowerCase().includes(term) ||
          p.email?.toLowerCase().includes(term) ||
          p.phone?.toLowerCase().includes(term)
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((p) => p.account_status === statusFilter);
    }

    // Verification filter
    if (verificationFilter === "email_verified") {
      filtered = filtered.filter((p) => p.email_verified);
    } else if (verificationFilter === "phone_verified") {
      filtered = filtered.filter((p) => p.phone_verified);
    } else if (verificationFilter === "unverified") {
      filtered = filtered.filter((p) => !p.email_verified && !p.phone_verified);
    }

    setFilteredPatrons(filtered);
  };

  const handleExport = () => {
    const exportData = filteredPatrons.map((p) => ({
      "User ID": p.id,
      "Full Name": p.full_name,
      Email: p.email || "N/A",
      Phone: p.phone || "N/A",
      "Email Verified": p.email_verified ? "Yes" : "No",
      "Phone Verified": p.phone_verified ? "Yes" : "No",
      "Push Notifications": p.has_push_enabled ? "Enabled" : "Disabled",
      "Signup Date": new Date(p.created_at).toLocaleDateString(),
      "Days Since Signup": p.days_since_signup,
      "Last Activity": p.last_activity_date
        ? new Date(p.last_activity_date).toLocaleDateString()
        : "Never",
      "Days Since Activity": p.days_since_last_activity ?? "N/A",
      "Total Orders": p.total_orders,
      "Total Waitlist Joins": p.total_waitlist_joins,
      "Preferred Venue": p.preferred_venue_name || "None",
      Status: p.account_status,
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);

    // Auto-size columns
    const colWidths = [
      { wch: 36 }, // User ID
      { wch: 20 }, // Full Name
      { wch: 25 }, // Email
      { wch: 15 }, // Phone
      { wch: 15 }, // Email Verified
      { wch: 15 }, // Phone Verified
      { wch: 18 }, // Push
      { wch: 12 }, // Signup Date
      { wch: 16 }, // Days Since Signup
      { wch: 12 }, // Last Activity
      { wch: 18 }, // Days Since Activity
      { wch: 12 }, // Orders
      { wch: 18 }, // Waitlist
      { wch: 20 }, // Preferred Venue
      { wch: 10 }, // Status
    ];
    ws["!cols"] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, "Patrons");
    XLSX.writeFile(wb, `ReadyUp_Patrons_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success("Patron data exported");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading patron data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Patrons</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.total_patrons}</div>
              <p className="text-xs text-muted-foreground">
                {summary.active_patrons} active, {summary.inactive_patrons} inactive
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Patrons</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.active_patrons}</div>
              <p className="text-xs text-muted-foreground">
                {summary.total_patrons > 0
                  ? ((summary.active_patrons / summary.total_patrons) * 100).toFixed(1)
                  : 0}
                % of total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
              <ShoppingBag className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.total_orders}</div>
              <p className="text-xs text-muted-foreground">
                {summary.avg_orders_per_patron.toFixed(2)} avg per patron
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Waitlist Joins</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.total_waitlist_joins}</div>
              <p className="text-xs text-muted-foreground">Across all venues</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Patron List</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Select value={verificationFilter} onValueChange={setVerificationFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Verification" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Verification</SelectItem>
                <SelectItem value="email_verified">Email Verified</SelectItem>
                <SelectItem value="phone_verified">Phone Verified</SelectItem>
                <SelectItem value="unverified">Unverified</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleExport} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>

          <div className="text-sm text-muted-foreground mb-4">
            Showing {filteredPatrons.length} of {patrons.length} patrons
          </div>

          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Verified</TableHead>
                    <TableHead>Signup</TableHead>
                    <TableHead>Last Activity</TableHead>
                    <TableHead>Orders</TableHead>
                    <TableHead>Waitlist</TableHead>
                    <TableHead>Preferred Venue</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPatrons.map((patron) => (
                    <TableRow key={patron.id}>
                      <TableCell className="font-medium">{patron.full_name}</TableCell>
                      <TableCell className="text-sm">{patron.email || "N/A"}</TableCell>
                      <TableCell className="text-sm">{patron.phone || "N/A"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {patron.email_verified && (
                            <Badge variant="outline" className="text-xs">
                              ✓ Email
                            </Badge>
                          )}
                          {patron.phone_verified && (
                            <Badge variant="outline" className="text-xs">
                              ✓ Phone
                            </Badge>
                          )}
                          {!patron.email_verified && !patron.phone_verified && (
                            <Badge variant="secondary" className="text-xs">
                              None
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(patron.created_at).toLocaleDateString()}
                        <div className="text-xs text-muted-foreground">
                          {patron.days_since_signup}d ago
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {patron.last_activity_date
                          ? new Date(patron.last_activity_date).toLocaleDateString()
                          : "Never"}
                        {patron.days_since_last_activity !== null && (
                          <div className="text-xs text-muted-foreground">
                            {patron.days_since_last_activity}d ago
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-center">{patron.total_orders}</TableCell>
                      <TableCell className="text-center">
                        {patron.total_waitlist_joins}
                      </TableCell>
                      <TableCell className="text-sm">
                        {patron.preferred_venue_name || "None"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={patron.account_status === "active" ? "default" : "secondary"}
                        >
                          {patron.account_status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};