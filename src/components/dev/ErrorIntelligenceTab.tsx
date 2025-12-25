import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, AlertCircle, Search, Trash2, Copy, Sparkles, Users, Bot, Store, TrendingUp } from 'lucide-react';
import { useAIOperations, PlatformError } from '@/hooks/useAIOperations';
import { formatDistanceToNow } from 'date-fns';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

export function ErrorIntelligenceTab() {
  const { errors, loading, updateErrorStatus, analyzeError, deleteError } = useAIOperations();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [selectedError, setSelectedError] = useState<PlatformError | null>(null);
  const [analyzing, setAnalyzing] = useState<string | null>(null);

  // Calculate analytics
  const analytics = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayErrors = errors.filter(e => new Date(e.created_at) >= today);
    const userReported = errors.filter(e => e.source === 'patron' || e.source === 'merchant');
    const autoCaputured = errors.filter(e => !e.source || e.source === 'auto');
    const newErrors = errors.filter(e => e.status === 'new');
    
    // Group by venue
    const byVenue = errors.reduce((acc, e) => {
      if (e.venue_name) {
        acc[e.venue_name] = (acc[e.venue_name] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    return {
      total: errors.length,
      today: todayErrors.length,
      userReported: userReported.length,
      autoCaptured: autoCaputured.length,
      new: newErrors.length,
      byVenue: Object.entries(byVenue).sort((a, b) => b[1] - a[1]).slice(0, 5),
    };
  }, [errors]);

  const filteredErrors = errors.filter(e => {
    const matchesStatus = statusFilter === 'all' || e.status === statusFilter;
    const matchesSource = sourceFilter === 'all' || 
      (sourceFilter === 'user' && (e.source === 'patron' || e.source === 'merchant')) ||
      (sourceFilter === 'auto' && (!e.source || e.source === 'auto')) ||
      e.source === sourceFilter;
    return matchesStatus && matchesSource;
  });

  const handleAnalyze = async (error: PlatformError) => {
    setAnalyzing(error.id);
    await analyzeError(error);
    setAnalyzing(null);
  };

  const handleCopyBugReport = (error: PlatformError) => {
    const analysis = error.ai_analysis?.content || 'No AI analysis available';
    const report = `## Bug Report

**Error Type:** ${error.error_type}
**Error Message:** ${error.error_message}
**Source:** ${error.source || 'auto'}
**Venue:** ${error.venue_name || 'N/A'}
**Route:** ${error.route || 'Unknown'}
**Component:** ${error.component || 'Unknown'}
**First Seen:** ${new Date(error.first_seen_at).toLocaleString()}
**Occurrences:** ${error.occurrence_count}

### Stack Trace
\`\`\`
${error.stack_trace || 'No stack trace available'}
\`\`\`

### AI Analysis
${analysis}

### Browser/Device Info
- Browser: ${error.browser_info || 'Unknown'}
- Device: ${error.device_info || 'Unknown'}
`;
    
    navigator.clipboard.writeText(report);
    toast.success('Bug report copied to clipboard');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'destructive';
      case 'investigating': return 'default';
      case 'resolved': return 'secondary';
      case 'ignored': return 'outline';
      default: return 'default';
    }
  };

  const getSourceBadge = (source: string | null | undefined) => {
    switch (source) {
      case 'patron':
        return <Badge variant="outline" className="gap-1 border-blue-500/50 text-blue-600"><Users className="h-3 w-3" />Patron</Badge>;
      case 'merchant':
        return <Badge variant="outline" className="gap-1 border-orange-500/50 text-orange-600"><Store className="h-3 w-3" />Merchant</Badge>;
      default:
        return <Badge variant="outline" className="gap-1 border-muted-foreground/50"><Bot className="h-3 w-3" />Auto</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Analytics Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="py-3 px-4">
            <CardDescription className="text-xs">Today</CardDescription>
            <CardTitle className="text-2xl">{analytics.today}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="py-3 px-4">
            <CardDescription className="text-xs flex items-center gap-1">
              <Users className="h-3 w-3" /> User Reported
            </CardDescription>
            <CardTitle className="text-2xl">{analytics.userReported}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="py-3 px-4">
            <CardDescription className="text-xs flex items-center gap-1">
              <Bot className="h-3 w-3" /> Auto-Captured
            </CardDescription>
            <CardTitle className="text-2xl">{analytics.autoCaptured}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="py-3 px-4">
            <CardDescription className="text-xs flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> New Issues
            </CardDescription>
            <CardTitle className="text-2xl text-destructive">{analytics.new}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Issues by Venue (if any) */}
      {analytics.byVenue.length > 0 && (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm">Issues by Venue</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 px-4 pb-3">
            <div className="flex flex-wrap gap-2">
              {analytics.byVenue.map(([venue, count]) => (
                <Badge key={venue} variant="secondary" className="gap-1">
                  {venue}: {count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <h3 className="font-semibold">Error Intelligence</h3>
          <Badge variant="outline">{errors.length} total</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Filter source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="user">User Reported</SelectItem>
              <SelectItem value="auto">Auto-Captured</SelectItem>
              <SelectItem value="patron">Patron Only</SelectItem>
              <SelectItem value="merchant">Merchant Only</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="investigating">Investigating</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="ignored">Ignored</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredErrors.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No errors captured yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Runtime errors and user reports will appear here
            </p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[500px]">
          <div className="space-y-3">
            {filteredErrors.map((error) => (
              <Card key={error.id} className="cursor-pointer hover:bg-muted/50 transition-colors">
                <CardHeader className="py-3 px-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge variant={getStatusColor(error.status)}>
                          {error.status}
                        </Badge>
                        {getSourceBadge(error.source)}
                        <Badge variant="outline">{error.error_type}</Badge>
                        {error.occurrence_count > 1 && (
                          <Badge variant="secondary">×{error.occurrence_count}</Badge>
                        )}
                        {error.venue_name && (
                          <Badge variant="secondary" className="text-xs">
                            📍 {error.venue_name}
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-sm font-mono truncate">
                        {error.error_message}
                      </CardTitle>
                      <CardDescription className="text-xs mt-1">
                        {error.route && <span className="mr-2">📍 {error.route}</span>}
                        {formatDistanceToNow(new Date(error.last_seen_at), { addSuffix: true })}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedError(error);
                        }}
                      >
                        <Search className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAnalyze(error);
                        }}
                        disabled={analyzing === error.id}
                      >
                        {analyzing === error.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyBugReport(error);
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                {error.ai_analysis && (
                  <CardContent className="pt-0 px-4 pb-3">
                    <div className="bg-muted/50 rounded-md p-3 text-xs">
                      <div className="flex items-center gap-1 text-muted-foreground mb-1">
                        <Sparkles className="h-3 w-3" />
                        AI Analysis
                      </div>
                      <p className="line-clamp-2">{error.ai_analysis.content?.substring(0, 200)}...</p>
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Error Detail Dialog */}
      <Dialog open={!!selectedError} onOpenChange={() => setSelectedError(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedError && (
            <>
              <DialogHeader>
                <DialogTitle className="font-mono text-sm break-all">
                  {selectedError.error_message}
                </DialogTitle>
                <DialogDescription>
                  First seen {formatDistanceToNow(new Date(selectedError.first_seen_at), { addSuffix: true })}
                  {selectedError.occurrence_count > 1 && ` • ${selectedError.occurrence_count} occurrences`}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={getStatusColor(selectedError.status)}>
                    {selectedError.status}
                  </Badge>
                  {getSourceBadge(selectedError.source)}
                  <Badge variant="outline">{selectedError.error_type}</Badge>
                  {selectedError.route && (
                    <Badge variant="secondary">📍 {selectedError.route}</Badge>
                  )}
                  {selectedError.venue_name && (
                    <Badge variant="secondary">🏪 {selectedError.venue_name}</Badge>
                  )}
                </div>

                {selectedError.stack_trace && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Stack Trace</h4>
                    <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto max-h-[200px]">
                      {selectedError.stack_trace}
                    </pre>
                  </div>
                )}

                {selectedError.ai_analysis?.content && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                      <Sparkles className="h-4 w-4" />
                      AI Analysis
                    </h4>
                    <div className="bg-muted rounded-md p-3 text-sm whitespace-pre-wrap">
                      {selectedError.ai_analysis.content}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2 flex-wrap">
                  <Select 
                    value={selectedError.status} 
                    onValueChange={(value) => updateErrorStatus(selectedError.id, value as PlatformError['status'])}
                  >
                    <SelectTrigger className="w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="investigating">Investigating</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="ignored">Ignored</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    onClick={() => handleAnalyze(selectedError)}
                    disabled={analyzing === selectedError.id}
                  >
                    {analyzing === selectedError.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-2" />
                    )}
                    Analyze with AI
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleCopyBugReport(selectedError)}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Bug Report
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => {
                      deleteError(selectedError.id);
                      setSelectedError(null);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
