import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Shield, CheckCircle2, XCircle, Clock, Download, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface DataRequest {
  id: string;
  user_id: string;
  request_type: string;
  status: string;
  reason: string | null;
  notes: string | null;
  processed_by: string | null;
  processed_at: string | null;
  created_at: string;
  profile?: { full_name: string; email: string | null };
}

export function DataRequestsPanel() {
  const [requests, setRequests] = useState<DataRequest[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("data_deletion_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) {
      // Fetch profiles for each request
      const userIds = [...new Set(data.map((r: any) => r.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      setRequests(
        data.map((r: any) => ({
          ...r,
          profile: profileMap.get(r.user_id),
        }))
      );
    }
    setLoading(false);
  };

  const handleUpdateStatus = async (requestId: string, newStatus: string) => {
    setProcessingId(requestId);
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error } = await supabase
      .from("data_deletion_requests")
      .update({
        status: newStatus,
        processed_by: user?.id,
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Updated", description: `Request marked as ${newStatus}` });
      fetchRequests();
    }
    setProcessingId(null);
  };

  const filtered = filterStatus === "all" 
    ? requests 
    : requests.filter(r => r.status === filterStatus);

  const pendingCount = requests.filter(r => r.status === "pending").length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending": return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />Pending</Badge>;
      case "processing": return <Badge className="bg-amber-500/20 text-amber-700 gap-1"><Clock className="h-3 w-3" />Processing</Badge>;
      case "completed": return <Badge className="bg-green-500/20 text-green-700 gap-1"><CheckCircle2 className="h-3 w-3" />Completed</Badge>;
      case "rejected": return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Rejected</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeIcon = (type: string) => {
    return type === "export" ? <Download className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="h-6 w-6" />
              <div>
                <CardTitle>POPIA Data Requests</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Manage patron data export and deletion requests
                </p>
              </div>
            </div>
            {pendingCount > 0 && (
              <Badge variant="destructive">{pendingCount} pending</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Requests</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>

          {loading ? (
            <p className="text-muted-foreground text-center py-8">Loading requests...</p>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No data requests found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((req) => (
                <Card key={req.id} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      {getTypeIcon(req.request_type)}
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium capitalize">{req.request_type} Request</p>
                          {getStatusBadge(req.status)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {req.profile?.full_name || "Unknown User"} 
                          {req.profile?.email && ` (${req.profile.email})`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Submitted {new Date(req.created_at).toLocaleString()}
                        </p>
                        {req.processed_at && (
                          <p className="text-xs text-muted-foreground">
                            Processed {new Date(req.processed_at).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>

                    {req.status === "pending" && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUpdateStatus(req.id, "processing")}
                          disabled={processingId === req.id}
                        >
                          Start Processing
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleUpdateStatus(req.id, "rejected")}
                          disabled={processingId === req.id}
                        >
                          Reject
                        </Button>
                      </div>
                    )}
                    {req.status === "processing" && (
                      <Button
                        size="sm"
                        onClick={() => handleUpdateStatus(req.id, "completed")}
                        disabled={processingId === req.id}
                      >
                        Mark Complete
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
