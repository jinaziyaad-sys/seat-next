import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { VenueLogo } from "@/components/VenueLogo";
import { Gift, Stamp, Star, ChevronRight, Loader2, Copy, Check, Trophy, Sparkles, Crown, Percent, Users, Target, Share2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface LoyaltyVoucher {
  code: string;
  reward_name: string | null;
  expires_at: string | null;
  status: string;
  redeemed_at: string | null;
}

interface LoyaltyCardData {
  venue_id: string;
  venue_name: string;
  venue_logo: string | null;
  program_type: "stamp_card" | "points";
  stamps_count: number;
  stamp_threshold: number;
  points_balance: number;
  lifetime_stamps: number;
  lifetime_points: number;
  active_codes: LoyaltyVoucher[];
  history_codes: LoyaltyVoucher[];
  admin_enabled: boolean;
  next_reward_name: string | null;
  next_reward_description: string | null;
  next_reward_threshold: number | null;
  tier_name: string | null;
  tier_color: string | null;
  tier_perks: string[];
  cashback_balance: number;
  cashback_active: boolean;
  referral_code: string | null;
  referral_uses: number;
  referral_active: boolean;
  referral_config_referrer_reward: string | null;
  referral_config_referee_reward: string | null;
  referral_already_used: boolean;
  active_challenges: { title: string; goal_value: number; current_progress: number; completed: boolean; reward_name: string }[];
}

interface PatronLoyaltyCardProps {
  compact?: boolean;
  venueId?: string;
}

export const PatronLoyaltyCard = ({ compact = false, venueId }: PatronLoyaltyCardProps) => {
  const { t } = useTranslation();
  const [cards, setCards] = useState<LoyaltyCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [claimingVenue, setClaimingVenue] = useState<string | null>(null);
  const [referralInput, setReferralInput] = useState<string>("");
  const [submittingReferral, setSubmittingReferral] = useState<string | null>(null);

  useEffect(() => {
    fetchLoyaltyData();
  }, [venueId]);

  const copyCode = async (code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success(t("loyalty.codeCopied"));
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const claimReward = async (venueId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setClaimingVenue(venueId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error(t("loyalty.pleaseSignIn")); return; }
      const { data, error } = await supabase.functions.invoke('claim-loyalty-reward', { body: { venue_id: venueId } });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }
      toast.success(t("loyalty.rewardClaimed", { reward: data.reward_name, code: data.code }));
      await fetchLoyaltyData();
    } catch (err: any) {
      toast.error(err.message || t("loyalty.failedClaimReward"));
    } finally { setClaimingVenue(null); }
  };

  const generateReferralCode = async (venueId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      await supabase.from("referral_codes").insert({ user_id: user.id, venue_id: venueId, code });
      toast.success(t("loyalty.referralGenerated"));
      await fetchLoyaltyData();
    } catch (err: any) {
      if (err.message?.includes("duplicate")) toast.info(t("loyalty.alreadyHaveReferral"));
      else toast.error(t("loyalty.failedGenerateCode"));
    }
  };

  const submitReferralCode = async (venueId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!referralInput.trim()) return;
    setSubmittingReferral(venueId);
    try {
      const { data, error } = await supabase.functions.invoke('process-referral', {
        body: { referral_code: referralInput.trim(), venue_id: venueId }
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }
      toast.success(`🎉 ${data.message || t("loyalty.referralApplied")}`);
      setReferralInput("");
      await fetchLoyaltyData();
    } catch (err: any) {
      toast.error(err.message || t("loyalty.failedApplyReferral"));
    } finally { setSubmittingReferral(null); }
  };

  const shareReferralCode = async (code: string, venueName: string, rewardInfo: string | null, e: React.MouseEvent) => {
    e.stopPropagation();
    const message = `Join me at ${venueName}! Use my referral code ${code} to earn bonus rewards.${rewardInfo ? ` ${rewardInfo}` : ''}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `${venueName} Referral`, text: message });
      } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(message);
      setCopiedCode(code);
      toast.success(t("loyalty.referralCopied"));
      setTimeout(() => setCopiedCode(null), 2000);
    }
  };

  const fetchLoyaltyData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    try {
      let query = supabase.from("patron_loyalty").select("*").eq("user_id", user.id);
      if (venueId) query = query.eq("venue_id", venueId);
      const { data: loyaltyData } = await query;
      if (!loyaltyData?.length) { setLoading(false); return; }

      const venueIds = loyaltyData.map(l => l.venue_id);

      const [venuesRes, programsRes, codesRes, rewardsRes, tiersRes, tierStatusRes, cashbackRes, cashbackConfigRes, referralRes, referralConfigRes, challengesRes, progressRes, referralCompletionsRes] = await Promise.all([
        supabase.from("venues").select("id, name, logo_url").in("id", venueIds),
        supabase.from("loyalty_programs").select("*").in("venue_id", venueIds).eq("is_active", true),
        supabase
          .from("discount_codes")
          .select("code, reward_name, venue_id, expires_at, status, redeemed_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase.from("loyalty_rewards").select("*").in("venue_id", venueIds).eq("is_active", true),
        supabase.from("loyalty_tiers").select("*").in("venue_id", venueIds).eq("is_active", true),
        supabase.from("patron_tier_status").select("*").eq("user_id", user.id).in("venue_id", venueIds),
        supabase.from("patron_cashback_balance").select("*").eq("user_id", user.id).in("venue_id", venueIds),
        supabase.from("venue_cashback_config").select("*").in("venue_id", venueIds),
        supabase.from("referral_codes").select("*").eq("user_id", user.id).in("venue_id", venueIds),
        supabase.from("venue_referral_config").select("*").in("venue_id", venueIds),
        supabase.from("loyalty_challenges").select("*").in("venue_id", venueIds).eq("is_active", true),
        supabase.from("patron_challenge_progress").select("*").eq("user_id", user.id),
        supabase.from("referral_completions").select("venue_id").eq("referee_id", user.id).in("venue_id", venueIds),
      ]);

      const venueMap = new Map(venuesRes.data?.map(v => [v.id, v]) || []);
      const programMap = new Map(programsRes.data?.map(p => [p.venue_id, p]) || []);
      const activeCodesMap = new Map<string, LoyaltyVoucher[]>();
      const historyCodesMap = new Map<string, LoyaltyVoucher[]>();
      const rewardsMap = new Map<string, { name: string; description: string | null; stamps_required: number | null; points_required: number | null }>();
      const now = new Date();

      rewardsRes.data?.forEach(r => {
        if (!rewardsMap.has(r.program_id)) rewardsMap.set(r.program_id, r);
      });
      codesRes.data?.forEach(c => {
        const voucher: LoyaltyVoucher = {
          code: c.code,
          reward_name: c.reward_name,
          expires_at: c.expires_at,
          status: c.status,
          redeemed_at: c.redeemed_at,
        };
        const isExpired = c.expires_at ? new Date(c.expires_at) <= now : false;
        const targetMap = c.status === "redeemed" || isExpired ? historyCodesMap : activeCodesMap;
        if (!targetMap.has(c.venue_id)) targetMap.set(c.venue_id, []);
        targetMap.get(c.venue_id)!.push(voucher);
      });

      const tierMap = new Map(tiersRes.data?.map(t => [t.id, t]) || []);
      const tierStatusMap = new Map(tierStatusRes.data?.map(ts => [ts.venue_id, ts]) || []);
      const cashbackMap = new Map(cashbackRes.data?.map(cb => [cb.venue_id, cb]) || []);
      const cashbackConfigMap = new Map(cashbackConfigRes.data?.map(cc => [cc.venue_id, cc]) || []);
      const referralMap = new Map(referralRes.data?.map(r => [r.venue_id, r]) || []);
      const referralConfigMap = new Map(referralConfigRes.data?.map(rc => [rc.venue_id, rc]) || []);
      const challengesByVenue = new Map<string, any[]>();
      challengesRes.data?.forEach(ch => {
        if (!challengesByVenue.has(ch.venue_id)) challengesByVenue.set(ch.venue_id, []);
        challengesByVenue.get(ch.venue_id)!.push(ch);
      });
      const progressMap = new Map(progressRes.data?.map(p => [p.challenge_id, p]) || []);
      const referralCompletedVenues = new Set(referralCompletionsRes.data?.map(rc => rc.venue_id) || []);

      const cardData: LoyaltyCardData[] = loyaltyData
        .map(l => {
          const venue = venueMap.get(l.venue_id);
          const program = programMap.get(l.venue_id);
          if (!venue || !program) return null;
          const reward = rewardsMap.get(program.id);

          const tierStatus = tierStatusMap.get(l.venue_id);
          const tier = tierStatus?.current_tier_id ? tierMap.get(tierStatus.current_tier_id) : null;
          const cb = cashbackMap.get(l.venue_id);
          const cbConfig = cashbackConfigMap.get(l.venue_id);
          const ref = referralMap.get(l.venue_id);
          const refConfig = referralConfigMap.get(l.venue_id);

          const venueChallenges = challengesByVenue.get(l.venue_id) || [];
          const activeChallenges = venueChallenges
            .filter(ch => !ch.end_date || new Date(ch.end_date) > new Date())
            .map(ch => {
              const prog = progressMap.get(ch.id);
              return {
                title: ch.title,
                goal_value: ch.goal_value,
                current_progress: prog?.current_progress || 0,
                completed: prog?.completed || false,
                reward_name: ch.reward_name,
              };
            });

          return {
            venue_id: l.venue_id,
            venue_name: venue.name,
            venue_logo: venue.logo_url,
            program_type: program.type as "stamp_card" | "points",
            stamps_count: l.stamps_count,
            stamp_threshold: program.stamp_threshold || 10,
            points_balance: l.points_balance,
            lifetime_stamps: l.lifetime_stamps,
            lifetime_points: l.lifetime_points,
            active_codes: activeCodesMap.get(l.venue_id) || [],
            history_codes: historyCodesMap.get(l.venue_id) || [],
            admin_enabled: program.admin_enabled !== false,
            next_reward_name: reward?.name || null,
            next_reward_description: reward?.description || null,
            next_reward_threshold: program.type === 'stamp_card' ? (reward?.stamps_required || program.stamp_threshold || 10) : (reward?.points_required || null),
            tier_name: tier?.tier_name || null,
            tier_color: tier?.color || null,
            tier_perks: tier?.perks ? (Array.isArray(tier.perks) ? tier.perks as string[] : []) : [],
            cashback_balance: cb?.balance || 0,
            cashback_active: cbConfig?.is_active || false,
            referral_code: ref?.code || null,
            referral_uses: ref?.uses_count || 0,
            referral_active: refConfig?.is_active || false,
            referral_config_referrer_reward: refConfig ? `${refConfig.referrer_reward_value} ${refConfig.referrer_reward_type}` : null,
            referral_config_referee_reward: refConfig ? `${refConfig.referee_reward_value} ${refConfig.referee_reward_type}` : null,
            referral_already_used: referralCompletedVenues.has(l.venue_id),
            active_challenges: activeChallenges,
          };
        })
        .filter(Boolean) as LoyaltyCardData[];

      setCards(cardData);
    } finally { setLoading(false); }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">{t("loyalty.loadingLoyalty")}</span>
      </div>
    );
  }

  if (cards.length === 0) {
    if (compact) return null;
    return (
      <Card className="shadow-card">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <Gift className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">{t("loyalty.loyaltyCards")}</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("loyalty.visitToEarn")}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {!compact && (
        <div className="flex items-center gap-2">
          <Gift className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">{t("loyalty.yourLoyaltyCards")}</h3>
        </div>
      )}

      {cards.map(card => {
        const hasRewards = card.active_codes.length > 0;
        const canClaim = !hasRewards && (
          (card.program_type === "stamp_card" && card.stamps_count >= card.stamp_threshold) ||
          (card.program_type === "points" && card.next_reward_threshold && card.points_balance >= card.next_reward_threshold)
        );
        return (
          <Card
            key={card.venue_id}
            className={cn(
              "overflow-hidden transition-all cursor-pointer hover:shadow-md",
              "bg-gradient-to-br from-card to-muted/50",
              hasRewards && "ring-2 ring-primary/40"
            )}
            onClick={() => setExpandedCard(expandedCard === card.venue_id ? null : card.venue_id)}
          >
            <CardContent className={cn("p-4", compact && "p-3")}>
              <div className="flex items-center gap-3">
                <VenueLogo logoUrl={card.venue_logo} name={card.venue_name} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm truncate">{card.venue_name}</p>
                    {!card.admin_enabled && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{t("loyalty.paused")}</Badge>
                    )}
                    {card.tier_name && (
                      <Badge className="text-[10px] px-1.5 py-0" style={{ backgroundColor: card.tier_color || '#FFD700', color: '#000' }}>
                        <Crown className="h-3 w-3 mr-0.5" />
                        {card.tier_name}
                      </Badge>
                    )}
                    {hasRewards && (
                      <Badge variant="default" className="text-[10px] px-1.5 py-0 bg-primary animate-pulse">
                        <Gift className="h-3 w-3 mr-0.5" /> {t("loyalty.rewardReady")}
                      </Badge>
                    )}
                  </div>

                  {card.program_type === "stamp_card" ? (
                    <div className="mt-1">
                      <div className="flex gap-1">
                        {Array.from({ length: card.stamp_threshold }).map((_, i) => (
                          <div key={i} className={cn("h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all", i < card.stamps_count ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/30")}>
                            {i < card.stamps_count && <Stamp className="h-3 w-3" />}
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {card.stamps_count}/{card.stamp_threshold} {t("loyalty.stamps")}
                        {card.next_reward_name
                          ? ` · ${t("loyalty.moreForReward", { count: card.stamp_threshold - card.stamps_count, reward: card.next_reward_name })}`
                          : ` · ${t("loyalty.keepCollecting")}`}
                      </p>
                    </div>
                  ) : (
                    <div className="mt-1">
                      <div className="flex items-center gap-2">
                        <Star className="h-4 w-4 text-amber-500" />
                        <span className="font-bold text-lg">{card.points_balance}</span>
                        <span className="text-xs text-muted-foreground">{t("loyalty.points")}</span>
                      </div>
                      {card.next_reward_name && card.next_reward_threshold && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {card.next_reward_threshold - card.points_balance > 0
                            ? t("loyalty.moreForReward", { count: card.next_reward_threshold - card.points_balance, reward: card.next_reward_name })
                            : t("loyalty.readyToClaim", { reward: card.next_reward_name })}
                        </p>
                      )}
                    </div>
                  )}

                  {(card.cashback_active && card.cashback_balance > 0) && (
                    <p className="text-xs text-green-600 mt-0.5 flex items-center gap-1">
                      <Percent className="h-3 w-3" /> {t("loyalty.creditAvailable", { amount: card.cashback_balance.toFixed(2) })}
                    </p>
                  )}
                </div>
                {canClaim && (
                  <button onClick={(e) => claimReward(card.venue_id, e)} disabled={claimingVenue === card.venue_id} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors animate-pulse shrink-0">
                    {claimingVenue === card.venue_id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} {t("loyalty.claim")}
                  </button>
                )}
                <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", expandedCard === card.venue_id && "rotate-90")} />
              </div>

              {/* Expanded section */}
              {expandedCard === card.venue_id && (
                <div className="mt-3 pt-3 border-t space-y-3">
                  {hasRewards && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase">{t("loyalty.yourRewards")}</p>
                      <p className="text-xs text-muted-foreground">{t("loyalty.tellStaff")}</p>
                      {card.active_codes.map((code, i) => (
                        <div key={`${code.code}-${i}`} className="flex items-center justify-between bg-primary/10 rounded-lg p-2.5">
                          <div>
                            <p className="text-sm font-medium">{code.reward_name || t("loyalty.reward")}</p>
                            <code className="text-xs font-mono text-primary font-bold">{code.code}</code>
                            {code.expires_at && (
                              <p className="text-[11px] text-muted-foreground mt-1">
                                {t("loyalty.expiresOn", { date: new Date(code.expires_at).toLocaleDateString() })}
                              </p>
                            )}
                          </div>
                          <button onClick={(e) => copyCode(code.code, e)} className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                            {copiedCode === code.code ? <><Check className="h-3 w-3" /> {t("loyalty.copied")}</> : <><Copy className="h-3 w-3" /> {t("loyalty.copy")}</>}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {card.history_codes.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase">Voucher History</p>
                      {card.history_codes.map((code, i) => {
                        const isRedeemed = code.status === "redeemed";
                        const historyDate = isRedeemed ? code.redeemed_at : code.expires_at;

                        return (
                          <div key={`${code.code}-history-${i}`} className="flex items-center justify-between rounded-lg border bg-muted/50 p-2.5 opacity-60">
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium">{code.reward_name || t("loyalty.reward")}</p>
                                <Badge variant="secondary" className="text-[10px]">
                                  {isRedeemed ? "Redeemed" : "Expired"}
                                </Badge>
                              </div>
                              <code className="text-xs font-mono text-muted-foreground font-bold">{code.code}</code>
                              {historyDate && (
                                <p className="text-[11px] text-muted-foreground mt-1">
                                  {isRedeemed ? "Redeemed" : "Expired"} {new Date(historyDate).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {card.next_reward_name && !hasRewards && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <Trophy className="h-3.5 w-3.5 text-primary" />
                        <p className="text-xs font-semibold">{t("loyalty.nextRewardLabel", { name: card.next_reward_name })}</p>
                      </div>
                      {card.next_reward_description && <p className="text-xs text-muted-foreground">{card.next_reward_description}</p>}
                      {card.program_type === "stamp_card" ? (
                        <Progress value={(card.stamps_count / card.stamp_threshold) * 100} className="h-2" />
                      ) : card.next_reward_threshold ? (
                        <Progress value={Math.min((card.points_balance / card.next_reward_threshold) * 100, 100)} className="h-2" />
                      ) : null}
                    </div>
                  )}

                  {card.tier_name && card.tier_perks.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold flex items-center gap-1">
                        <Crown className="h-3 w-3" style={{ color: card.tier_color || '#FFD700' }} />
                        {t("loyalty.perks", { tier: card.tier_name })}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {card.tier_perks.map((perk, i) => (
                          <Badge key={i} variant="secondary" className="text-[10px]">{perk}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {card.referral_active && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold flex items-center gap-1">
                        <Users className="h-3 w-3 text-primary" /> {t("loyalty.referAFriend")}
                      </p>
                      {card.referral_config_referrer_reward && (
                        <p className="text-[11px] text-muted-foreground">
                          {t("loyalty.youGet")} <span className="font-semibold text-foreground">{card.referral_config_referrer_reward}</span>, {t("loyalty.theyGet")} <span className="font-semibold text-foreground">{card.referral_config_referee_reward}</span> {t("loyalty.whenUseCode")}
                        </p>
                      )}
                      {card.referral_code ? (
                        <div className="bg-primary/10 rounded-lg p-2.5 space-y-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs text-muted-foreground">{t("loyalty.yourCode")}</p>
                              <code className="text-sm font-mono font-bold text-primary">{card.referral_code}</code>
                              <p className="text-[10px] text-muted-foreground">{t("loyalty.referralsMade", { count: card.referral_uses })}</p>
                            </div>
                            <div className="flex gap-1.5">
                              <button onClick={(e) => copyCode(card.referral_code!, e)} className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
                                {copiedCode === card.referral_code ? <><Check className="h-3 w-3" /> {t("loyalty.copied")}</> : <><Copy className="h-3 w-3" /> {t("loyalty.copy")}</>}
                              </button>
                              <button onClick={(e) => shareReferralCode(card.referral_code!, card.venue_name, card.referral_config_referee_reward, e)} className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                                <Share2 className="h-3 w-3" /> {t("common.share")}
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <button onClick={(e) => generateReferralCode(card.venue_id, e)} className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                          {t("loyalty.getReferralCode")}
                        </button>
                      )}

                      {card.referral_already_used ? (
                        <div className="flex items-center gap-1.5 text-xs text-green-600 bg-green-500/10 rounded-lg p-2">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>{t("loyalty.referralAppliedVenue")}</span>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <p className="text-[11px] text-muted-foreground">{t("loyalty.haveReferralCode")}</p>
                          <div className="flex gap-1.5">
                            <Input
                              placeholder={t("loyalty.enterCode")}
                              value={referralInput}
                              onChange={(e) => setReferralInput(e.target.value.toUpperCase())}
                              onClick={(e) => e.stopPropagation()}
                              className="h-8 text-xs font-mono uppercase"
                              maxLength={10}
                            />
                            <button
                              onClick={(e) => submitReferralCode(card.venue_id, e)}
                              disabled={!referralInput.trim() || submittingReferral === card.venue_id}
                              className="shrink-0 flex items-center gap-1 text-xs px-3 py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                            >
                              {submittingReferral === card.venue_id ? <Loader2 className="h-3 w-3 animate-spin" /> : t("loyalty.apply")}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {card.active_challenges.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold flex items-center gap-1">
                        <Target className="h-3 w-3 text-orange-500" /> {t("loyalty.activeChallenges")}
                      </p>
                      {card.active_challenges.map((ch, i) => (
                        <div key={i} className="bg-orange-500/10 rounded-lg p-2 space-y-1">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-medium">{ch.title}</p>
                            {ch.completed && <Badge className="text-[10px] bg-green-500">{t("loyalty.done")}</Badge>}
                          </div>
                          <Progress value={(ch.current_progress / ch.goal_value) * 100} className="h-1.5" />
                          <p className="text-[10px] text-muted-foreground">
                            {ch.current_progress}/{ch.goal_value} · {t("loyalty.rewardLabel", { name: ch.reward_name })}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="text-[11px] text-muted-foreground">
                    {card.program_type === "stamp_card"
                      ? t("loyalty.lifetimeStamps", { count: card.lifetime_stamps })
                      : t("loyalty.lifetimePoints", { count: card.lifetime_points })}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
