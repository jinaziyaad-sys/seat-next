import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, Trash2, ExternalLink, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { withRateLimit } from "@/utils/rateLimiter";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface DataRequest {
  id: string;
  request_type: string;
  status: string;
  created_at: string;
}

export function DataPrivacySection() {
  const { t } = useTranslation();
  const [requests, setRequests] = useState<DataRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    const { data } = await supabase
      .from("data_deletion_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5);
    if (data) setRequests(data as DataRequest[]);
  };

  const handleDeletionRequest = async () => {
    setLoading(true);
    const result = await withRateLimit(
      "data-request",
      async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const { error } = await supabase.from("data_deletion_requests").insert({
          user_id: user.id,
          request_type: "deletion",
          status: "pending",
        });
        if (error) throw error;
        return true;
      },
      () => toast({ title: t("privacy.pleaseWait"), description: t("privacy.oneRequestAtTime"), variant: "destructive" })
    );

    if (result) {
      toast({ title: t("privacy.deletionRequested"), description: t("privacy.deletionRequestedDesc") });
      fetchRequests();
    }
    setLoading(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending": return <Badge variant="secondary">Pending</Badge>;
      case "processing": return <Badge className="bg-amber-500/20 text-amber-700">Processing</Badge>;
      case "completed": return <Badge className="bg-green-500/20 text-green-700">Completed</Badge>;
      case "rejected": return <Badge variant="destructive">Rejected</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <div className="flex items-center gap-3">
          <Shield size={24} />
          <CardTitle>{t("privacy.title")}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {t("privacy.description")}
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="gap-2" disabled={loading}>
                <Trash2 className="h-4 w-4" />
                {t("privacy.requestDeletion")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("privacy.deleteConfirmTitle")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t("privacy.deleteConfirmDesc")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeletionRequest}>
                  {t("privacy.yesDelete")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <Button
          variant="link"
          className="gap-2 p-0 h-auto text-sm"
          onClick={() => navigate("/privacy")}
        >
          <ExternalLink className="h-3 w-3" />
          {t("privacy.viewPrivacyPolicy")}
        </Button>

        {requests.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-sm font-medium">{t("privacy.recentRequests")}</p>
            {requests.map((req) => (
              <div key={req.id} className="flex items-center justify-between text-sm border rounded-lg p-3">
                <div>
                  <span className="font-medium capitalize">{req.request_type}</span>
                  <span className="text-muted-foreground ml-2">
                    {new Date(req.created_at).toLocaleDateString()}
                  </span>
                </div>
                {getStatusBadge(req.status)}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
