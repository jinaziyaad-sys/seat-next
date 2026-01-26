import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DateRangePicker } from '@/components/merchant/DateRangePicker';
import {
  Activity,
  ArrowUpDown,
  Building2,
  ChefHat,
  Clock,
  Download,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  Star,
  TrendingDown,
  TrendingUp,
  Users,
  XCircle,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import * as XLSX from 'xlsx';

interface VenueHealthMetrics {
  venue_id: string;
  venue_name: string;
  total_orders: number;
  completed_orders: number;
  total_waitlist: number;
  seated_waitlist: number;
  avg_prep_time: number;
  quoted_prep_time: number;
  prep_accuracy_pct: number;
  avg_wait_time: number;
  quoted_wait_time: number;
  wait_accuracy_pct: number;
  avg_order_rating: number;
  avg_waitlist_rating: number;
  combined_rating: number;
  total_ratings: number;
  no_show_count: number;
  no_show_rate_pct: number;
  cancelled_orders: number;
  rejected_orders: number;
  health_score: number;
  last_activity: string | null;
}

type SortField = 'venue_name' | 'health_score' | 'prep_accuracy_pct' | 'wait_accuracy_pct' | 'combined_rating' | 'total_orders' | 'no_show_rate_pct';
type SortDirection = 'asc' | 'desc';
type HealthFilter = 'all' | 'healthy' | 'warning' | 'critical' | 'inactive';

export function VenueHealthReport() {
  const [loading, setLoading] = useState(true);
  const [venues, setVenues] = useState<VenueHealthMetrics[]>([]);
  const [startDate, setStartDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d;
  });
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('health_score');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [healthFilter, setHealthFilter] = useState<HealthFilter>('all');

  const fetchHealthReport = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-venue-health-report', {
        body: {
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
        },
      });

      if (error) throw error;
      setVenues(data.venues || []);
    } catch (error) {
      console.error('Error fetching venue health report:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthReport();
  }, [startDate, endDate]);

  const handleDateChange = (start: Date, end: Date) => {
    setStartDate(start);
    setEndDate(end);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getHealthStatus = (score: number, hasData: boolean): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } => {
    if (!hasData) return { label: 'Inactive', variant: 'outline' };
    if (score >= 80) return { label: 'Healthy', variant: 'default' };
    if (score >= 60) return { label: 'Warning', variant: 'secondary' };
    return { label: 'Critical', variant: 'destructive' };
  };

  const filteredAndSortedVenues = useMemo(() => {
    let filtered = venues.filter(v => 
      v.venue_name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Apply health filter
    if (healthFilter !== 'all') {
      filtered = filtered.filter(v => {
        const hasData = v.total_orders > 0 || v.total_waitlist > 0;
        const status = getHealthStatus(v.health_score, hasData);
        if (healthFilter === 'inactive') return status.label === 'Inactive';
        if (healthFilter === 'healthy') return status.label === 'Healthy';
        if (healthFilter === 'warning') return status.label === 'Warning';
        if (healthFilter === 'critical') return status.label === 'Critical';
        return true;
      });
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal: number | string = a[sortField];
      let bVal: number | string = b[sortField];

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = (bVal as string).toLowerCase();
      }

      if (sortDirection === 'asc') {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      }
      return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
    });

    return filtered;
  }, [venues, searchQuery, sortField, sortDirection, healthFilter]);

  const stats = useMemo(() => {
    const withData = venues.filter(v => v.total_orders > 0 || v.total_waitlist > 0);
    const healthy = withData.filter(v => v.health_score >= 80).length;
    const warning = withData.filter(v => v.health_score >= 60 && v.health_score < 80).length;
    const critical = withData.filter(v => v.health_score < 60).length;
    const inactive = venues.length - withData.length;

    const avgHealth = withData.length > 0
      ? withData.reduce((sum, v) => sum + v.health_score, 0) / withData.length
      : 0;

    return { healthy, warning, critical, inactive, avgHealth, total: venues.length };
  }, [venues]);

  const exportToExcel = () => {
    const exportData = filteredAndSortedVenues.map(v => ({
      'Venue Name': v.venue_name,
      'Health Score': v.health_score,
      'Total Orders': v.total_orders,
      'Completed Orders': v.completed_orders,
      'Prep Accuracy %': v.prep_accuracy_pct,
      'Avg Prep Time (min)': v.avg_prep_time,
      'Total Waitlist': v.total_waitlist,
      'Seated Waitlist': v.seated_waitlist,
      'Wait Accuracy %': v.wait_accuracy_pct,
      'Avg Wait Time (min)': v.avg_wait_time,
      'Combined Rating': v.combined_rating,
      'Total Ratings': v.total_ratings,
      'No-Show Rate %': v.no_show_rate_pct,
      'Cancelled Orders': v.cancelled_orders,
      'Rejected Orders': v.rejected_orders,
      'Last Activity': v.last_activity ? format(new Date(v.last_activity), 'yyyy-MM-dd HH:mm') : 'Never',
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Venue Health Report');
    XLSX.writeFile(wb, `venue-health-report-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead 
      className="cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        <ArrowUpDown className={`h-3 w-3 ${sortField === field ? 'text-primary' : 'text-muted-foreground'}`} />
      </div>
    </TableHead>
  );

  if (loading && venues.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Activity className="h-6 w-6" />
          Venue Health Report
        </h2>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchHealthReport}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportToExcel}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onDateChange={handleDateChange}
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Total Venues</div>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-success">
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> Healthy
            </div>
            <div className="text-2xl font-bold text-success">{stats.healthy}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-warning">
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Warning</div>
            <div className="text-2xl font-bold text-warning">{stats.warning}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-destructive">
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <TrendingDown className="h-3 w-3" /> Critical
            </div>
            <div className="text-2xl font-bold text-destructive">{stats.critical}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Avg Health Score</div>
            <div className="text-2xl font-bold">{stats.avgHealth.toFixed(1)}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search venues..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={healthFilter} onValueChange={(v) => setHealthFilter(v as HealthFilter)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Venues</SelectItem>
                  <SelectItem value="healthy">Healthy</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHeader field="venue_name">Venue</SortableHeader>
                  <SortableHeader field="health_score">Health</SortableHeader>
                  <SortableHeader field="prep_accuracy_pct">Prep Accuracy</SortableHeader>
                  <SortableHeader field="wait_accuracy_pct">Wait Accuracy</SortableHeader>
                  <SortableHeader field="combined_rating">Rating</SortableHeader>
                  <SortableHeader field="total_orders">Orders</SortableHeader>
                  <SortableHeader field="no_show_rate_pct">No-Shows</SortableHeader>
                  <TableHead>Last Activity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedVenues.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No venues found matching your criteria
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAndSortedVenues.map((venue) => {
                    const hasData = venue.total_orders > 0 || venue.total_waitlist > 0;
                    const healthStatus = getHealthStatus(venue.health_score, hasData);

                    return (
                      <TableRow key={venue.venue_id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{venue.venue_name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge variant={healthStatus.variant}>{healthStatus.label}</Badge>
                              {hasData && <span className="text-sm font-medium">{venue.health_score}%</span>}
                            </div>
                            {hasData && (
                              <Progress 
                                value={venue.health_score} 
                                className="h-1.5 w-20"
                              />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {venue.completed_orders > 0 ? (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1">
                                <ChefHat className="h-3 w-3 text-muted-foreground" />
                                <span className={venue.prep_accuracy_pct >= 80 ? 'text-success' : venue.prep_accuracy_pct >= 60 ? 'text-warning' : 'text-destructive'}>
                                  {venue.prep_accuracy_pct}%
                                </span>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {venue.avg_prep_time}m avg / {venue.quoted_prep_time}m quoted
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">No data</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {venue.seated_waitlist > 0 ? (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3 text-muted-foreground" />
                                <span className={venue.wait_accuracy_pct >= 80 ? 'text-success' : venue.wait_accuracy_pct >= 60 ? 'text-warning' : 'text-destructive'}>
                                  {venue.wait_accuracy_pct}%
                                </span>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {venue.avg_wait_time}m avg / {venue.quoted_wait_time}m quoted
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">No data</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {venue.total_ratings > 0 ? (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1">
                                <Star className="h-3 w-3 fill-primary text-primary" />
                                <span className="font-medium">{venue.combined_rating.toFixed(1)}</span>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {venue.total_ratings} rating{venue.total_ratings !== 1 ? 's' : ''}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">No ratings</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">{venue.total_orders}</div>
                            <div className="text-xs text-muted-foreground">
                              {venue.completed_orders} completed
                              {venue.cancelled_orders > 0 && (
                                <span className="text-destructive"> · {venue.cancelled_orders} cancelled</span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {venue.total_waitlist > 0 ? (
                            <div className="flex items-center gap-1">
                              <XCircle className={`h-3 w-3 ${venue.no_show_rate_pct > 20 ? 'text-destructive' : 'text-muted-foreground'}`} />
                              <span className={venue.no_show_rate_pct > 20 ? 'text-destructive' : ''}>
                                {venue.no_show_rate_pct}%
                              </span>
                              <span className="text-xs text-muted-foreground">({venue.no_show_count})</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {venue.last_activity ? (
                            <div className="text-sm text-muted-foreground">
                              {formatDistanceToNow(new Date(venue.last_activity), { addSuffix: true })}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">Never</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
