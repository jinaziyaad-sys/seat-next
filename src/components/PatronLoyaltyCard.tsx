import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { VenueLogo } from "@/components/VenueLogo";
import { Gift, Stamp, Star, ChevronRight, Ticket, Loader2, Copy, Check, Trophy } from "lucide-react";
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

  const fetchLoyaltyData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    try {
      let query = supabase
        .from("patron_loyalty")
        .select("*")
        .eq("user_id", user.id);
      
      if (venueId) query = query.eq("venue_id", venueId);

      const { data: loyaltyData } = await query;
      if (!loyaltyData?.length) { setLoading(false); return; }

      const venueIds = loyaltyData.map(l => l.venue_id);
      
      const [venuesRes, programsRes, codesRes, rewardsRes] = await Promise.all([
        supabase.from("venues").select("id, name, logo_url").in("id", venueIds),
        supabase.from("loyalty_programs").select("*").in("venue_id", venueIds).eq("is_active", true),
        supabase.from("discount_codes").select("code, reward_name, venue_id").eq("user_id", user.id).eq("status", "active"),
        supabase.from("loyalty_rewards").select("*").in("venue_id", venueIds).eq("is_active", true),
      ]);

      const venueMap = new Map(venuesRes.data?.map(v => [v.id, v]) || []);
      const programMap = new Map(programsRes.data?.map(p => [p.venue_id, p]) || []);
      const codesMap = new Map<string, { code: string; reward_name: string | null }[]>();
      // Build rewards map keyed by program_id
      const rewardsMap = new Map<string, { name: string; description: string | null; stamps_required: number | null; points_required: number | null }>();
      rewardsRes.data?.forEach(r => {
        // Keep the first (lowest threshold) reward per program
        if (!rewardsMap.has(r.program_id)) {
          rewardsMap.set(r.program_id, { name: r.name, description: r.description, stamps_required: r.stamps_required, points_required: r.points_required });
        }
      });

      codesRes.data?.forEach(c => {
        if (!codesMap.has(c.venue_id)) codesMap.set(c.venue_id, []);
        codesMap.get(c.venue_id)!.push(c);
      });

      const cardData: LoyaltyCardData[] = loyaltyData
        .map(l => {
          const venue = venueMap.get(l.venue_id);
          const program = programMap.get(l.venue_id);
          if (!venue || !program) return null;
          const reward = rewardsMap.get(program.id);
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
          };
        })
        .filter(Boolean) as LoyaltyCardData[];

      setCards(cardData);
    } finally {
      setLoading(false);
    }
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
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm truncate">{card.venue_name}</p>
                    {!card.admin_enabled && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Paused</Badge>
                    )}
                    {hasRewards && (
                      <Badge variant="default" className="text-[10px] px-1.5 py-0 bg-primary animate-pulse">
                        <Gift className="h-3 w-3 mr-0.5" />
                        Reward Ready!
                      </Badge>
                    )}
                  </div>

                  {card.program_type === "stamp_card" ? (
                    <div className="mt-1">
                      <div className="flex gap-1">
                        {Array.from({ length: card.stamp_threshold }).map((_, i) => (
                          <div
                            key={i}
                            className={cn(
                              "h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all",
                              i < card.stamps_count
                                ? "bg-primary border-primary text-primary-foreground"
                                : "border-muted-foreground/30"
                            )}
                          >
                            {i < card.stamps_count && <Stamp className="h-3 w-3" />}
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {card.stamps_count}/{card.stamp_threshold} stamps
                        {card.next_reward_name 
                          ? ` · ${card.stamp_threshold - card.stamps_count} more for ${card.next_reward_name}`
                          : " · Keep collecting!"}
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
                </div>
                <ChevronRight className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform",
                  expandedCard === card.venue_id && "rotate-90"
                )} />
              </div>

              {/* Expanded: active reward codes */}
              {expandedCard === card.venue_id && hasRewards && (
                <div className="mt-3 pt-3 border-t space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Your Rewards</p>
                  <p className="text-xs text-muted-foreground">
                    Tell the staff your code when ordering to redeem your reward.
                  </p>
                  {card.active_codes.map((code, i) => (
                    <div key={i} className="flex items-center justify-between bg-primary/10 rounded-lg p-2.5">
                      <div>
                        <p className="text-sm font-medium">{code.reward_name || "Reward"}</p>
                        <code className="text-xs font-mono text-primary font-bold">{code.code}</code>
                      </div>
                      <button
                        onClick={(e) => copyCode(code.code, e)}
                        className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                      >
                        {copiedCode === code.code ? (
                          <><Check className="h-3 w-3" /> Copied</>
                        ) : (
                          <><Copy className="h-3 w-3" /> Copy</>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {expandedCard === card.venue_id && (
                <div className="mt-2 pt-2 border-t space-y-2">
                  {/* Progress toward next reward */}
                  {card.next_reward_name && !hasRewards && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <Trophy className="h-3.5 w-3.5 text-primary" />
                        <p className="text-xs font-semibold">Next Reward: {card.next_reward_name}</p>
                      </div>
                      {card.next_reward_description && (
                        <p className="text-xs text-muted-foreground">{card.next_reward_description}</p>
                      )}
                      {card.program_type === "stamp_card" ? (
                        <Progress value={(card.stamps_count / card.stamp_threshold) * 100} className="h-2" />
                      ) : card.next_reward_threshold ? (
                        <Progress value={Math.min((card.points_balance / card.next_reward_threshold) * 100, 100)} className="h-2" />
                      ) : null}
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    Lifetime: {card.program_type === "stamp_card" 
                      ? `${card.lifetime_stamps} stamps earned` 
                      : `${card.lifetime_points} points earned`
                    }
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
