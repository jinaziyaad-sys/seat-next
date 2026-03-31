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
  active_codes: { code: string; reward_name: string | null }[];
  admin_enabled: boolean;
  next_reward_name: string | null;
  next_reward_description: string | null;
  next_reward_threshold: number | null;
  // New loyalty features
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
    toast.success("Code copied!");
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const claimReward = async (venueId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setClaimingVenue(venueId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Please sign in"); return; }
      const { data, error } = await supabase.functions.invoke('claim-loyalty-reward', { body: { venue_id: venueId } });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }
      toast.success(`🎉 Reward claimed: ${data.reward_name}! Code: ${data.code}`);
      await fetchLoyaltyData();
    } catch (err: any) {
      toast.error(err.message || "Failed to claim reward");
    } finally { setClaimingVenue(null); }
  };

  const generateReferralCode = async (venueId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      await supabase.from("referral_codes").insert({ user_id: user.id, venue_id: venueId, code });
      toast.success("Referral code generated!");
      await fetchLoyaltyData();
    } catch (err: any) {
      if (err.message?.includes("duplicate")) toast.info("You already have a referral code");
      else toast.error("Failed to generate code");
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
      toast.success(`🎉 ${data.message || "Referral applied!"}`);
      setReferralInput("");
      await fetchLoyaltyData();
    } catch (err: any) {
      toast.error(err.message || "Failed to apply referral code");
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
      toast.success("Referral message copied!");
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

      const [venuesRes, programsRes, codesRes, rewardsRes, tiersRes, tierStatusRes, cashbackRes, cashbackConfigRes, referralRes, referralConfigRes, challengesRes, progressRes] = await Promise.all([
        supabase.from("venues").select("id, name, logo_url").in("id", venueIds),
        supabase.from("loyalty_programs").select("*").in("venue_id", venueIds).eq("is_active", true),
        supabase.from("discount_codes").select("code, reward_name, venue_id").eq("user_id", user.id).eq("status", "active"),
        supabase.from("loyalty_rewards").select("*").in("venue_id", venueIds).eq("is_active", true),
        supabase.from("loyalty_tiers").select("*").in("venue_id", venueIds).eq("is_active", true),
        supabase.from("patron_tier_status").select("*").eq("user_id", user.id).in("venue_id", venueIds),
        supabase.from("patron_cashback_balance").select("*").eq("user_id", user.id).in("venue_id", venueIds),
        supabase.from("venue_cashback_config").select("*").in("venue_id", venueIds),
        supabase.from("referral_codes").select("*").eq("user_id", user.id).in("venue_id", venueIds),
        supabase.from("venue_referral_config").select("*").in("venue_id", venueIds),
        supabase.from("loyalty_challenges").select("*").in("venue_id", venueIds).eq("is_active", true),
        supabase.from("patron_challenge_progress").select("*").eq("user_id", user.id),
      ]);

      const venueMap = new Map(venuesRes.data?.map(v => [v.id, v]) || []);
      const programMap = new Map(programsRes.data?.map(p => [p.venue_id, p]) || []);
      const codesMap = new Map<string, { code: string; reward_name: string | null }[]>();
      const rewardsMap = new Map<string, { name: string; description: string | null; stamps_required: number | null; points_required: number | null }>();

      rewardsRes.data?.forEach(r => {
        if (!rewardsMap.has(r.program_id)) rewardsMap.set(r.program_id, r);
      });
      codesRes.data?.forEach(c => {
        if (!codesMap.has(c.venue_id)) codesMap.set(c.venue_id, []);
        codesMap.get(c.venue_id)!.push(c);
      });

      // Build tier map: tierId -> tier
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

      const cardData: LoyaltyCardData[] = loyaltyData
        .map(l => {
          const venue = venueMap.get(l.venue_id);
          const program = programMap.get(l.venue_id);
          if (!venue || !program) return null;
          const reward = rewardsMap.get(program.id);

          // Tier info
          const tierStatus = tierStatusMap.get(l.venue_id);
          const tier = tierStatus?.current_tier_id ? tierMap.get(tierStatus.current_tier_id) : null;

          // Cashback
          const cb = cashbackMap.get(l.venue_id);
          const cbConfig = cashbackConfigMap.get(l.venue_id);

          // Referral
          const ref = referralMap.get(l.venue_id);
          const refConfig = referralConfigMap.get(l.venue_id);

          // Challenges
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
            active_codes: codesMap.get(l.venue_id) || [],
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
        <span className="text-sm">Loading loyalty...</span>
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
            <h3 className="font-semibold">Loyalty Cards</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Visit participating restaurants to start earning stamps or points toward rewards!
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
          <h3 className="font-semibold">Your Loyalty Cards</h3>
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
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Paused</Badge>
                    )}
                    {card.tier_name && (
                      <Badge className="text-[10px] px-1.5 py-0" style={{ backgroundColor: card.tier_color || '#FFD700', color: '#000' }}>
                        <Crown className="h-3 w-3 mr-0.5" />
                        {card.tier_name}
                      </Badge>
                    )}
                    {hasRewards && (
                      <Badge variant="default" className="text-[10px] px-1.5 py-0 bg-primary animate-pulse">
                        <Gift className="h-3 w-3 mr-0.5" /> Reward Ready!
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
                        {card.stamps_count}/{card.stamp_threshold} stamps
                        {card.next_reward_name ? ` · ${card.stamp_threshold - card.stamps_count} more for ${card.next_reward_name}` : " · Keep collecting!"}
                      </p>
                    </div>
                  ) : (
                    <div className="mt-1">
                      <div className="flex items-center gap-2">
                        <Star className="h-4 w-4 text-amber-500" />
                        <span className="font-bold text-lg">{card.points_balance}</span>
                        <span className="text-xs text-muted-foreground">points</span>
                      </div>
                      {card.next_reward_name && card.next_reward_threshold && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {card.next_reward_threshold - card.points_balance > 0
                            ? `${card.next_reward_threshold - card.points_balance} more for ${card.next_reward_name}`
                            : `Ready to claim: ${card.next_reward_name}!`}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Compact extras line */}
                  {(card.cashback_active && card.cashback_balance > 0) && (
                    <p className="text-xs text-green-600 mt-0.5 flex items-center gap-1">
                      <Percent className="h-3 w-3" /> R{card.cashback_balance.toFixed(2)} credit available
                    </p>
                  )}
                </div>
                {canClaim && (
                  <button onClick={(e) => claimReward(card.venue_id, e)} disabled={claimingVenue === card.venue_id} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors animate-pulse shrink-0">
                    {claimingVenue === card.venue_id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} Claim!
                  </button>
                )}
                <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", expandedCard === card.venue_id && "rotate-90")} />
              </div>

              {/* Expanded section */}
              {expandedCard === card.venue_id && (
                <div className="mt-3 pt-3 border-t space-y-3">
                  {/* Active reward codes */}
                  {hasRewards && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase">Your Rewards</p>
                      <p className="text-xs text-muted-foreground">Tell the staff your code when ordering to redeem your reward.</p>
                      {card.active_codes.map((code, i) => (
                        <div key={i} className="flex items-center justify-between bg-primary/10 rounded-lg p-2.5">
                          <div>
                            <p className="text-sm font-medium">{code.reward_name || "Reward"}</p>
                            <code className="text-xs font-mono text-primary font-bold">{code.code}</code>
                          </div>
                          <button onClick={(e) => copyCode(code.code, e)} className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                            {copiedCode === code.code ? <><Check className="h-3 w-3" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Progress toward next reward */}
                  {card.next_reward_name && !hasRewards && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <Trophy className="h-3.5 w-3.5 text-primary" />
                        <p className="text-xs font-semibold">Next Reward: {card.next_reward_name}</p>
                      </div>
                      {card.next_reward_description && <p className="text-xs text-muted-foreground">{card.next_reward_description}</p>}
                      {card.program_type === "stamp_card" ? (
                        <Progress value={(card.stamps_count / card.stamp_threshold) * 100} className="h-2" />
                      ) : card.next_reward_threshold ? (
                        <Progress value={Math.min((card.points_balance / card.next_reward_threshold) * 100, 100)} className="h-2" />
                      ) : null}
                    </div>
                  )}

                  {/* VIP Tier perks */}
                  {card.tier_name && card.tier_perks.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold flex items-center gap-1">
                        <Crown className="h-3 w-3" style={{ color: card.tier_color || '#FFD700' }} />
                        {card.tier_name} Perks
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {card.tier_perks.map((perk, i) => (
                          <Badge key={i} variant="secondary" className="text-[10px]">{perk}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Referral code */}
                  {card.referral_active && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold flex items-center gap-1">
                        <Users className="h-3 w-3 text-blue-500" /> Referral
                      </p>
                      {card.referral_code ? (
                        <div className="flex items-center justify-between bg-blue-500/10 rounded-lg p-2">
                          <div>
                            <p className="text-xs text-muted-foreground">Share your code:</p>
                            <code className="text-sm font-mono font-bold text-blue-600">{card.referral_code}</code>
                            <p className="text-[10px] text-muted-foreground">{card.referral_uses} referral{card.referral_uses !== 1 ? 's' : ''} made</p>
                          </div>
                          <button onClick={(e) => copyCode(card.referral_code!, e)} className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-blue-500 text-white hover:bg-blue-600 transition-colors">
                            {copiedCode === card.referral_code ? <><Check className="h-3 w-3" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
                          </button>
                        </div>
                      ) : (
                        <button onClick={(e) => generateReferralCode(card.venue_id, e)} className="text-xs px-3 py-1.5 rounded-md bg-blue-500 text-white hover:bg-blue-600 transition-colors">
                          Get Referral Code
                        </button>
                      )}
                    </div>
                  )}

                  {/* Active challenges */}
                  {card.active_challenges.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold flex items-center gap-1">
                        <Target className="h-3 w-3 text-orange-500" /> Active Challenges
                      </p>
                      {card.active_challenges.map((ch, i) => (
                        <div key={i} className="bg-orange-500/10 rounded-lg p-2 space-y-1">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-medium">{ch.title}</p>
                            {ch.completed && <Badge className="text-[10px] bg-green-500">✓ Done</Badge>}
                          </div>
                          <Progress value={(ch.current_progress / ch.goal_value) * 100} className="h-1.5" />
                          <p className="text-[10px] text-muted-foreground">
                            {ch.current_progress}/{ch.goal_value} · Reward: {ch.reward_name}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Lifetime stats */}
                  <p className="text-[11px] text-muted-foreground">
                    Lifetime: {card.program_type === "stamp_card" ? `${card.lifetime_stamps} stamps earned` : `${card.lifetime_points} points earned`}
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
