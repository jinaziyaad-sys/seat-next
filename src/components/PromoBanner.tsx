import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { VenueLogo } from "@/components/VenueLogo";
import { Megaphone, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Campaign {
  id: string;
  venue_id: string;
  title: string;
  description: string | null;
  banner_image_url: string | null;
  cta_text: string | null;
  cta_link: string | null;
  venue_name?: string;
  venue_logo?: string | null;
}

interface PromoBannerProps {
  placement: "home" | "explore" | "tracking";
  className?: string;
  onDismiss?: () => void;
  onNavigateToVenue?: (venueId: string) => void;
}

export const PromoBanner = ({ placement, className, onDismiss, onNavigateToVenue }: PromoBannerProps) => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [paused, setPaused] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const pauseTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchCampaigns();
  }, [placement]);

  // Auto-rotate carousel with smooth crossfade — 15s interval for comfortable reading
  useEffect(() => {
    if (campaigns.length <= 1 || paused) return;
    const interval = setInterval(() => {
      transitionTo((prev: number) => (prev + 1) % campaigns.length);
    }, 15000);
    return () => clearInterval(interval);
  }, [campaigns.length, paused]);

  const transitionTo = (getNext: (prev: number) => number) => {
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex(getNext);
      // Smooth fade in after content swap
      requestAnimationFrame(() => {
        setIsTransitioning(false);
      });
    }, 300);
  };

  const fetchCampaigns = async () => {
    const now = new Date().toISOString();
    const { data } = await supabase
      .from("promo_campaigns")
      .select("*")
      .eq("is_active", true)
      .contains("placements", [placement])
      .lte("start_date", now)
      .or(`end_date.is.null,end_date.gt.${now}`)
      .limit(20);

    if (!data?.length) return;

    // Get targeting rules for targeted campaigns
    const targetedIds = data.filter(c => c.targeting_type === 'targeted').map(c => c.id);
    let targetingMap = new Map<string, any>();
    if (targetedIds.length > 0) {
      const { data: rules } = await supabase
        .from("promo_targeting_rules")
        .select("*")
        .in("campaign_id", targetedIds);
      if (rules) {
        targetingMap = new Map(rules.map(r => [r.campaign_id, r]));
      }
    }

    // Get current user info for filtering
    const { data: { user } } = await supabase.auth.getUser();
    let patronCuisines: string[] = [];
    let patronVisitedVenues = new Set<string>();

    if (user) {
      // Fetch patron preferences and history in parallel
      const [{ data: prefs }, { data: orders }, { data: waitlist }] = await Promise.all([
        supabase.from("patron_dining_preferences").select("cuisine_preferences").eq("user_id", user.id).single(),
        supabase.from("orders").select("venue_id").eq("user_id", user.id).limit(200),
        supabase.from("waitlist_entries").select("venue_id").eq("user_id", user.id).limit(200),
      ]);
      patronCuisines = (prefs?.cuisine_preferences || []).map((c: string) => c.toLowerCase());
      for (const o of orders || []) patronVisitedVenues.add(o.venue_id);
      for (const w of waitlist || []) patronVisitedVenues.add(w.venue_id);
    }

    // Filter campaigns by targeting rules
    const now2 = new Date();
    const currentHour = now2.getHours();
    const currentDay = now2.getDay();

    const matched = data.filter(campaign => {
      if (campaign.targeting_type !== 'targeted') return true; // broad campaigns always show

      const rules = targetingMap.get(campaign.id);
      if (!rules) return true; // no rules = show

      let matchType: string | null = null;

      // Time-based filter
      if (rules.time_slots && Array.isArray(rules.time_slots) && rules.time_slots.length > 0) {
        const timeMatch = rules.time_slots.some((slot: any) => {
          const dayMatch = !slot.days || slot.days.includes(currentDay);
          const hourMatch = currentHour >= (slot.start_hour || 0) && currentHour <= (slot.end_hour || 23);
          return dayMatch && hourMatch;
        });
        if (!timeMatch) return false;
        matchType = 'time';
      }

      // Past visitors filter
      if (rules.target_past_visitors && user) {
        if (!patronVisitedVenues.has(campaign.venue_id)) return false;
        matchType = 'past_visitor';
      }

      // Cuisine filter
      if (rules.cuisine_tags && rules.cuisine_tags.length > 0 && user) {
        const cuisineMatch = rules.cuisine_tags.some((tag: string) => patronCuisines.includes(tag.toLowerCase()));
        if (!cuisineMatch) return false;
        matchType = 'cuisine';
      }

      // Location filter is harder client-side (requires patron location), so we allow it through
      // The server-side estimation already filtered by location

      return true;
    });

    if (!matched.length) return;

    const shuffled = matched.sort(() => Math.random() - 0.5).slice(0, 10);

    const venueIds = [...new Set(shuffled.map(c => c.venue_id))];
    const { data: venues } = await supabase
      .from("venues")
      .select("id, name, logo_url")
      .in("id", venueIds);

    const venueMap = new Map(venues?.map(v => [v.id, v]) || []);
    setCampaigns(shuffled.map(c => ({
      ...c,
      venue_name: venueMap.get(c.venue_id)?.name,
      venue_logo: venueMap.get(c.venue_id)?.logo_url,
    })));

    // Track impressions
    for (const campaign of shuffled) {
      const matchType = campaign.targeting_type === 'targeted' ? detectMatchType(targetingMap.get(campaign.id), patronCuisines, patronVisitedVenues, campaign.venue_id) : null;
      await supabase.from("promo_impressions").insert({
        campaign_id: campaign.id,
        user_id: user?.id || null,
        placement,
        targeting_match_type: matchType,
      });
      await (supabase.rpc as any)("increment_promo_impressions", { campaign_uuid: campaign.id });
    }
  };

  const detectMatchType = (rules: any, cuisines: string[], visited: Set<string>, venueId: string): string | null => {
    if (!rules) return null;
    if (rules.target_past_visitors && visited.has(venueId)) return 'past_visitor';
    if (rules.cuisine_tags?.length && rules.cuisine_tags.some((t: string) => cuisines.includes(t.toLowerCase()))) return 'cuisine';
    if (rules.location_radius_km) return 'location';
    if (rules.time_slots?.length) return 'time';
    return null;
  };

  const trackClick = async (campaignId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("promo_impressions").insert({
      campaign_id: campaignId,
      user_id: user?.id || null,
      placement,
      clicked: true,
    });
    // Increment the campaign's clicks_count for merchant visibility
    await (supabase.rpc as any)("increment_promo_clicks", { campaign_uuid: campaignId });
  };

  const handleCTAClick = (campaign: Campaign) => {
    trackClick(campaign.id);
    if (campaign.cta_link) {
      window.open(campaign.cta_link, "_blank");
    } else if (onNavigateToVenue) {
      onNavigateToVenue(campaign.venue_id);
    }
  };

  const pauseAndResume = useCallback(() => {
    setPaused(true);
    if (pauseTimeout.current) clearTimeout(pauseTimeout.current);
    pauseTimeout.current = setTimeout(() => setPaused(false), 10000);
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || campaigns.length <= 1) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      pauseAndResume();
      if (diff > 0) {
        transitionTo(prev => (prev + 1) % campaigns.length);
      } else {
        transitionTo(prev => (prev - 1 + campaigns.length) % campaigns.length);
      }
    }
    touchStartX.current = null;
  };

  if (campaigns.length === 0 || dismissed) return null;

  const campaign = campaigns[currentIndex];

  if (placement === "tracking") {
    return (
      <div className={cn("relative rounded-lg overflow-hidden bg-gradient-to-r from-primary/10 to-accent/10 border transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]", isTransitioning ? "opacity-0 translate-y-1" : "opacity-100 translate-y-0", className)}>
        <div className="flex items-center gap-3 p-3">
          <Megaphone className="h-4 w-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{campaign.title}</p>
            {campaign.venue_name && (
              <p className="text-xs text-muted-foreground">at {campaign.venue_name}</p>
            )}
          </div>
          {campaign.cta_text && (
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 text-xs"
              onClick={() => handleCTAClick(campaign)}
            >
              {campaign.cta_text}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={() => { setDismissed(true); onDismiss?.(); }}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn("relative group", className)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5 transition-shadow duration-300 hover:shadow-md">
        <CardContent className="p-0">
          <div className={cn(
            "transition-all duration-700 ease-[cubic-bezier(0.4,0,0.2,1)]",
            isTransitioning ? "opacity-0 translate-y-2 scale-[0.98]" : "opacity-100 translate-y-0 scale-100"
          )}>
            {campaign.banner_image_url && (
              <div
                className="relative w-full overflow-hidden cursor-pointer aspect-video"
                onClick={() => handleCTAClick(campaign)}
              >
                <img
                  src={campaign.banner_image_url}
                  alt={campaign.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-2 left-3 right-3">
                  <p className="text-white font-bold text-lg leading-tight">{campaign.title}</p>
                </div>
              </div>
            )}

            <div className="p-4">
              {!campaign.banner_image_url && (
                <div className="flex items-center gap-2 mb-2">
                  <Megaphone className="h-4 w-4 text-primary" />
                  <p className="font-bold">{campaign.title}</p>
                </div>
              )}
              
              {campaign.description && (
                <p className="text-sm text-muted-foreground mb-3">{campaign.description}</p>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {campaign.venue_logo && (
                    <VenueLogo logoUrl={campaign.venue_logo} name={campaign.venue_name || ""} size="sm" />
                  )}
                  {campaign.venue_name && (
                    <span className="text-sm font-medium">{campaign.venue_name}</span>
                  )}
                </div>
                
                {campaign.cta_text && (
                  <Button
                    size="sm"
                    onClick={() => handleCTAClick(campaign)}
                  >
                    {campaign.cta_text}
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Carousel dots with better styling */}
          {campaigns.length > 1 && (
            <div className="flex items-center justify-center gap-2 pb-3 px-4">
              {campaigns.map((_, i) => (
                <button
                  key={i}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-500 ease-out",
                    i === currentIndex 
                      ? "w-8 bg-primary" 
                      : "w-1.5 bg-muted-foreground/25 hover:bg-muted-foreground/40"
                  )}
                  onClick={() => { pauseAndResume(); transitionTo(() => i); }}
                  aria-label={`Go to promo ${i + 1}`}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sponsored badge */}
      <Badge variant="outline" className="absolute top-2 right-2 text-[10px] bg-background/80 backdrop-blur-sm">
        Sponsored
      </Badge>
    </div>
  );
};
