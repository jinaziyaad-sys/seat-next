import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Gift, Copy, Check, Loader2, Clock, Ticket } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VenueLogo } from "@/components/VenueLogo";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface VoucherCode {
  code: string;
  reward_name: string | null;
  image_url: string | null;
  expires_at: string | null;
  status: string;
  redeemed_at: string | null;
}

interface VenueStampData {
  venue_id: string;
  venue_name: string;
  venue_logo: string | null;
  stamps_count: number;
  stamp_threshold: number;
  next_reward_name: string | null;
  next_reward_description: string | null;
  active_codes: VoucherCode[];
  history_codes: VoucherCode[];
  program_id: string;
}

interface LoyaltyReadyFlowProps {
  onBack: () => void;
}

export const LoyaltyReadyFlow = ({ onBack }: LoyaltyReadyFlowProps) => {
  const { t } = useTranslation();
  const [view, setView] = useState<"hub" | "venue">("hub");
  const [venues, setVenues] = useState<VenueStampData[]>([]);
  const [selectedVenue, setSelectedVenue] = useState<VenueStampData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeInnerTab, setActiveInnerTab] = useState<"stamps" | "vouchers">("stamps");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  // Real-time subscription for stamp updates
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      channel = supabase
        .channel('loyalty-patron-updates')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'patron_loyalty',
          filter: `user_id=eq.${user.id}`
        }, () => {
          fetchData();
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'discount_codes',
          filter: `user_id=eq.${user.id}`
        }, () => {
          fetchData();
        })
        .subscribe();
    };

    setupRealtime();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    try {
      const { data: loyaltyData } = await supabase
        .from("patron_loyalty")
        .select("*")
        .eq("user_id", user.id);

      if (!loyaltyData?.length) { setLoading(false); return; }

      const venueIds = loyaltyData.map(l => l.venue_id);

      const [venuesRes, programsRes, codesRes, rewardsRes] = await Promise.all([
        supabase.from("venues").select("id, name, logo_url").in("id", venueIds),
        supabase.from("loyalty_programs").select("*").in("venue_id", venueIds).eq("is_active", true).eq("type", "stamp_card"),
        supabase
          .from("discount_codes")
          .select("code, reward_name, venue_id, reward_id, expires_at, status, redeemed_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase.from("loyalty_rewards").select("*").in("venue_id", venueIds).eq("is_active", true),
      ]);

      const venueMap = new Map(venuesRes.data?.map(v => [v.id, v]) || []);
      const programMap = new Map(programsRes.data?.map(p => [p.venue_id, p]) || []);
      const activeCodesMap = new Map<string, VoucherCode[]>();
      const historyCodesMap = new Map<string, VoucherCode[]>();
      const now = new Date();

      codesRes.data?.forEach(c => {
        const reward = rewardsRes.data?.find(r => r.id === c.reward_id);
        const voucher: VoucherCode = {
          code: c.code,
          reward_name: c.reward_name,
          image_url: reward?.image_url || null,
          expires_at: c.expires_at,
          status: c.status,
          redeemed_at: c.redeemed_at,
        };
        const isExpired = c.expires_at ? new Date(c.expires_at) <= now : false;
        const targetMap = c.status === "redeemed" || isExpired ? historyCodesMap : activeCodesMap;
        if (!targetMap.has(c.venue_id)) targetMap.set(c.venue_id, []);
        targetMap.get(c.venue_id)!.push(voucher);
      });
      const rewardsMap = new Map<string, any>();
      rewardsRes.data?.forEach(r => {
        if (!rewardsMap.has(r.program_id)) rewardsMap.set(r.program_id, r);
      });

      const stampVenues: VenueStampData[] = loyaltyData
        .map(l => {
          const venue = venueMap.get(l.venue_id);
          const program = programMap.get(l.venue_id);
          if (!venue || !program) return null;
          const reward = rewardsMap.get(program.id);
          const codes = activeCodesMap.get(l.venue_id) || [];

          return {
            venue_id: l.venue_id,
            venue_name: venue.name,
            venue_logo: venue.logo_url,
            stamps_count: l.stamps_count,
            stamp_threshold: program.stamp_threshold || 10,
            next_reward_name: reward?.name || null,
            next_reward_description: reward?.description || null,
            active_codes: activeCodesMap.get(l.venue_id) || [],
            history_codes: historyCodesMap.get(l.venue_id) || [],
            program_id: program.id,
          };
        })
        .filter(Boolean) as VenueStampData[];

      setVenues(stampVenues);
    } finally {
      setLoading(false);
    }
  };

  const copyCode = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success(t("loyalty.codeCopied"));
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const selectVenue = (v: VenueStampData) => {
    setSelectedVenue(v);
    setActiveInnerTab("stamps");
    setView("venue");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Hub View
  if (view === "hub") {
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Gift className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold">{t("loyaltyFlow.title")}</h1>
        </div>

        {venues.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Gift className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-lg font-semibold mb-2">{t("loyaltyFlow.noPrograms")}</h2>
            <p className="text-sm text-muted-foreground">{t("loyaltyFlow.noProgramsDesc")}</p>
          </div>
        ) : (
          <div className="p-6">
            <p className="text-sm text-muted-foreground mb-4">{t("loyaltyFlow.hubSubtitle")}</p>
            <div className="grid grid-cols-3 gap-6">
              {venues.map((v) => (
                <motion.button
                  key={v.venue_id}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => selectVenue(v)}
                  className="flex flex-col items-center gap-2 group"
                >
                  <div className="relative">
                    <VenueLogo
                      logoUrl={v.venue_logo}
                      name={v.venue_name}
                      size="xl"
                      className={cn(
                        "ring-2 ring-border group-hover:ring-primary transition-all",
                        v.active_codes.length > 0 && "ring-primary shadow-[0_0_12px_hsl(var(--primary)/0.3)]"
                      )}
                    />
                    {v.active_codes.length > 0 && (
                      <span className="absolute -bottom-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-accent text-accent-foreground flex items-center justify-center gap-0.5">
                        <Ticket className="h-2.5 w-2.5" />
                        <span className="text-[9px] font-bold">{v.active_codes.length}</span>
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-medium text-center leading-tight line-clamp-2">
                    {v.venue_name}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {v.stamps_count}/{v.stamp_threshold}
                  </span>
                </motion.button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Venue Stamp Page
  if (!selectedVenue) return null;

  const remaining = selectedVenue.stamp_threshold - selectedVenue.stamps_count;
  const currentVenue = venues.find(v => v.venue_id === selectedVenue.venue_id) || selectedVenue;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setView("hub")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <VenueLogo logoUrl={currentVenue.venue_logo} name={currentVenue.venue_name} size="sm" />
        <h1 className="text-lg font-bold truncate">{currentVenue.venue_name}</h1>
      </div>

      {/* Inner Tabs */}
      <div className="flex border-b">
        <button
          onClick={() => setActiveInnerTab("stamps")}
          className={cn(
            "flex-1 py-3 text-sm font-medium text-center transition-colors border-b-2",
            activeInnerTab === "stamps"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          {t("loyaltyFlow.stamps")}
        </button>
        <button
          onClick={() => setActiveInnerTab("vouchers")}
          className={cn(
            "flex-1 py-3 text-sm font-medium text-center transition-colors border-b-2 relative",
            activeInnerTab === "vouchers"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          {t("loyaltyFlow.vouchers")}
          {currentVenue.active_codes.length > 0 && (
            <span className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground font-bold">
              {currentVenue.active_codes.length}
            </span>
          )}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeInnerTab === "stamps" ? (
          <motion.div
            key="stamps"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="p-6 space-y-6"
          >
            {/* Stamp Grid */}
            <div className="flex flex-wrap gap-3 justify-center">
              {Array.from({ length: currentVenue.stamp_threshold }).map((_, i) => {
                const isFilled = i < currentVenue.stamps_count;
                return (
                  <motion.div
                    key={i}
                    initial={isFilled ? { scale: 0 } : { scale: 1 }}
                    animate={{ scale: 1 }}
                    transition={{
                      type: "spring",
                      damping: 12,
                      stiffness: 200,
                      delay: isFilled ? i * 0.05 : 0,
                    }}
                    className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center transition-all",
                      isFilled
                        ? "bg-primary text-primary-foreground shadow-[0_0_12px_hsl(var(--primary)/0.4)]"
                        : "border-2 border-dashed border-muted-foreground/30"
                    )}
                  >
                    {isFilled && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: i * 0.05 + 0.2 }}
                      >
                        <Check className="h-5 w-5" />
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {/* Progress Text */}
            <div className="text-center space-y-1">
              <p className="text-lg font-bold">
                {currentVenue.stamps_count}/{currentVenue.stamp_threshold} {t("loyalty.stamps")}
              </p>
              {currentVenue.next_reward_name && remaining > 0 && (
                <p className="text-sm text-muted-foreground">
                  {t("loyalty.moreForReward", { count: remaining, reward: currentVenue.next_reward_name })}
                </p>
              )}
            </div>

            {/* Next Reward Info */}
            {currentVenue.next_reward_name && (
              <Card className="bg-muted/50">
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">{t("loyaltyFlow.nextReward")}</p>
                  <p className="font-semibold">{currentVenue.next_reward_name}</p>
                  {currentVenue.next_reward_description && (
                    <p className="text-xs text-muted-foreground mt-1">{currentVenue.next_reward_description}</p>
                  )}
                </CardContent>
              </Card>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="vouchers"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="p-6 space-y-3"
          >
            {currentVenue.active_codes.length === 0 && currentVenue.history_codes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3">
                  <Gift className="h-7 w-7 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">{t("loyaltyFlow.noVouchers")}</p>
                <p className="text-xs text-muted-foreground mt-1">{t("loyaltyFlow.noVouchersDesc")}</p>
              </div>
            ) : (
              <>
                {currentVenue.active_codes.length > 0 && currentVenue.active_codes.map((vc) => (
                  <Card key={vc.code} className="overflow-hidden">
                    <CardContent className="p-0">
                      {vc.image_url && (
                        <img src={vc.image_url} alt={vc.reward_name || ''} className="w-full h-32 object-cover" />
                      )}
                      <div className="p-4 flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm">{vc.reward_name || t("loyalty.reward")}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {t("loyalty.tellStaff")}
                          </p>
                          {vc.expires_at && (
                            <div className="flex items-center gap-1 mt-1">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              <p className="text-xs text-muted-foreground">
                                {t("loyalty.expiresOn", { date: new Date(vc.expires_at).toLocaleDateString() })}
                              </p>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <code className="bg-muted px-3 py-1.5 rounded-md text-sm font-mono font-bold tracking-wider">
                            {vc.code}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={() => copyCode(vc.code)}
                          >
                            {copiedCode === vc.code ? (
                              <Check className="h-4 w-4 text-primary" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {currentVenue.history_codes.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Voucher History</p>
                    {currentVenue.history_codes.map((vc) => {
                      const isRedeemed = vc.status === "redeemed";
                      const historyDate = isRedeemed ? vc.redeemed_at : vc.expires_at;

                      return (
                        <Card key={`${vc.code}-history`} className="overflow-hidden opacity-60">
                          <CardContent className="p-0">
                            {vc.image_url && (
                              <img src={vc.image_url} alt={vc.reward_name || ''} className="w-full h-32 object-cover grayscale" />
                            )}
                            <div className="p-4 flex items-center justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-semibold text-sm">{vc.reward_name || t("loyalty.reward")}</p>
                                  <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                    {isRedeemed ? "Redeemed" : "Expired"}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {historyDate
                                    ? `${isRedeemed ? "Redeemed" : "Expired"} ${new Date(historyDate).toLocaleDateString()}`
                                    : isRedeemed ? "Redeemed" : "Expired"}
                                </p>
                              </div>
                              <code className="bg-muted px-3 py-1.5 rounded-md text-sm font-mono font-bold tracking-wider text-muted-foreground">
                                {vc.code}
                              </code>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
