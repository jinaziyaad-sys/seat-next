import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ScrollText, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

interface AuditEntry {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, any>;
  created_at: string;
}

const PAGE_SIZE = 20;

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-green-500/20 text-green-700',
  update: 'bg-blue-500/20 text-blue-700',
  delete: 'bg-red-500/20 text-red-700',
  assign_role: 'bg-amber-500/20 text-amber-700',
  remove_role: 'bg-red-500/20 text-red-700',
};

export function AuditLogPanel() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [filterEntity, setFilterEntity] = useState<string>('all');
  const [filterAction, setFilterAction] = useState<string>('all');

  const fetchEntries = async () => {
    setLoading(true);
    let query = (supabase as any)
      .from('platform_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    if (filterEntity !== 'all') {
      query = query.eq('entity_type', filterEntity);
    }
    if (filterAction !== 'all') {
      query = query.eq('action', filterAction);
    }

    const { data, error } = await query;
    if (!error && data) {
      setEntries(data as AuditEntry[]);
      setHasMore(data.length > PAGE_SIZE);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchEntries();
  }, [page, filterEntity, filterAction]);

  useEffect(() => {
    setPage(0);
  }, [filterEntity, filterAction]);

  const formatDetails = (details: Record<string, any>) => {
    if (!details || Object.keys(details).length === 0) return null;
    return Object.entries(details)
      .filter(([, v]) => v !== null && v !== undefined)
      .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
      .join(' · ');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ScrollText className="h-5 w-5" />
          Platform Audit Log
        </CardTitle>
        <CardDescription>Track all administrative actions across the platform</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <Select value={filterEntity} onValueChange={setFilterEntity}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Entity type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Entities</SelectItem>
              <SelectItem value="venue">Venues</SelectItem>
              <SelectItem value="user_role">User Roles</SelectItem>
              <SelectItem value="platform_config">Config</SelectItem>
              <SelectItem value="loyalty_program">Loyalty</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterAction} onValueChange={setFilterAction}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="create">Create</SelectItem>
              <SelectItem value="update">Update</SelectItem>
              <SelectItem value="delete">Delete</SelectItem>
              <SelectItem value="assign_role">Assign Role</SelectItem>
              <SelectItem value="remove_role">Remove Role</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : entries.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No audit entries found</p>
        ) : (
          <div className="space-y-2">
            {entries.slice(0, PAGE_SIZE).map((entry) => (
              <div key={entry.id} className="flex items-start gap-3 border rounded-lg p-3 text-sm">
                <Badge className={ACTION_COLORS[entry.action] || 'bg-muted text-muted-foreground'}>
                  {entry.action}
                </Badge>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium capitalize">{entry.entity_type.replace('_', ' ')}</span>
                    <span className="text-muted-foreground text-xs">
                      {format(new Date(entry.created_at), 'dd MMM yyyy HH:mm:ss')}
                    </span>
                  </div>
                  {formatDetails(entry.details) && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {formatDetails(entry.details)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Previous
          </Button>
          <span className="text-sm text-muted-foreground">Page {page + 1}</span>
          <Button variant="outline" size="sm" disabled={!hasMore} onClick={() => setPage(p => p + 1)}>
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
