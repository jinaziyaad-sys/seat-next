import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Gift, Search, CheckCircle, Loader2, Settings, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LoyaltySettings } from "./LoyaltySettings";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface DiscountCode {
  id: string;
  code: string;
  reward_name: string | null;
  status: string;
  user_id: string;
  created_at: string;
  redeemed_at: string | null;
  expires_at: string | null;
  patron_name?: string;
}

interface LoyaltyManagementProps {
  venueId: string;
}

export const LoyaltyManagement = ({ venueId }: LoyaltyManagementProps) => {
  const { toast } = useToast();
  const [codes, setCodes] = useState<DiscountCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [redeemingCode, setRedeemingCode] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    fetchCodes();
  }, [venueId]);

  const fetchCodes = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("discount_codes")
        .select("*")
        .eq("venue_id", venueId)
        .order("created_at", { ascending: false });

      if (data) {
        const userIds = [...new Set(data.map(c => c.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);
        setCodes(data.map(c => ({ ...c, patron_name: profileMap.get(c.user_id) || "Unknown" })));
      }
    } finally {
      setLoading(false);
    }
  };

  const isExpired = (code: DiscountCode) => {
    return code.expires_at && new Date(code.expires_at) < new Date();
  };

  const handleRedeem = async (codeId: string) => {
    const code = codes.find(c => c.id === codeId);
    if (code && isExpired(code)) {
      toast({ title: "Cannot redeem", description: "This voucher has expired.", variant: "destructive" });
      return;
    }
    setRedeemingCode(codeId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("discount_codes")
        .update({ 
          status: "redeemed", 
          redeemed_at: new Date().toISOString(),
          redeemed_by_staff_id: user?.id 
        })
        .eq("id", codeId);

      if (error) throw error;
      toast({ title: "Code redeemed successfully!" });
      fetchCodes();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setRedeemingCode(null);
    }
  };

  const filteredCodes = codes.filter(c =>
    c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.patron_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.reward_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeCodes = filteredCodes.filter(c => c.status === "active");
  const redeemedCodes = filteredCodes.filter(c => c.status === "redeemed");

  return (
    <div className="space-y-6">
      {/* Program Settings Button - prominent, matching other tab patterns */}
      <Button
        variant="outline"
        className="w-full justify-between h-auto py-4 px-5"
        onClick={() => setSettingsOpen(true)}
      >
        <div className="flex items-center gap-3">
          <Settings className="h-5 w-5 text-muted-foreground" />
          <div className="text-left">
            <p className="font-medium">Program Settings</p>
            <p className="text-sm text-muted-foreground font-normal">
              Configure stamp thresholds, rewards, and voucher details
            </p>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
      </Button>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by code, patron name, or reward..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Gift className="h-4 w-4 text-primary" />
          <span>{activeCodes.length} active</span>
        </div>
        <span>·</span>
        <div className="flex items-center gap-1.5">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <span>{redeemedCodes.length} redeemed</span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Active Codes */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Active Codes ({activeCodes.length})
            </h3>
            {activeCodes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No active discount codes</p>
            ) : (
              activeCodes.map(code => (
                <Card key={code.id}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <code className="font-mono font-bold text-lg">{code.code}</code>
                        {isExpired(code) ? (
                          <Badge variant="destructive" className="text-xs">Expired</Badge>
                        ) : (
                          <Badge variant="default" className="text-xs">Active</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {code.reward_name} · {code.patron_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Issued {new Date(code.created_at).toLocaleDateString()}
                        {code.expires_at && ` · Expires ${new Date(code.expires_at).toLocaleDateString()}`}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleRedeem(code.id)}
                      disabled={redeemingCode === code.id || isExpired(code)}
                      variant={isExpired(code) ? "outline" : "default"}
                    >
                      {redeemingCode === code.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : isExpired(code) ? (
                        "Expired"
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Redeem
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Redeemed Codes */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Redeemed ({redeemedCodes.length})
            </h3>
            {redeemedCodes.slice(0, 10).map(code => (
              <Card key={code.id} className="opacity-60">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <code className="font-mono">{code.code}</code>
                      <Badge variant="secondary" className="text-xs">Redeemed</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {code.reward_name} · {code.patron_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Redeemed {code.redeemed_at ? new Date(code.redeemed_at).toLocaleDateString() : ""}
                    </p>
                  </div>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Settings Sheet */}
      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Program Settings</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <LoyaltySettings venueId={venueId} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};
