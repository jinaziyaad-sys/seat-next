import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { VenueLogo } from "@/components/VenueLogo";
import { ChevronLeft, ChevronRight, Megaphone, X } from "lucide-react";
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
}

export const PromoBanner = ({ placement, className, onDismiss }: PromoBannerProps) => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetchCampaigns();
  }, [placement]);

  // Auto-rotate carousel
  useEffect(() => {
    if (campaigns.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % campaigns.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [campaigns.length]);

  const fetchCampaigns = async () => {
    const { data } = await supabase
      .from("promo_campaigns")
      .select("*")
      .eq("is_active", true)
      .contains("placements", [placement]);

    if (data?.length) {
      const venueIds = [...new Set(data.map(c => c.venue_id))];
      const { data: venues } = await supabase
        .from("venues")
        .select("id, name, logo_url")
        .in("id", venueIds);

      const venueMap = new Map(venues?.map(v => [v.id, v]) || []);
      setCampaigns(data.map(c => ({
        ...c,
        venue_name: venueMap.get(c.venue_id)?.name,
        venue_logo: venueMap.get(c.venue_id)?.logo_url,
      })));

      // Track impressions
      const { data: { user } } = await supabase.auth.getUser();
      data.forEach(campaign => {
        supabase.from("promo_impressions").insert({
          campaign_id: campaign.id,
          user_id: user?.id || null,
          placement,
        }).then(() => {});
      });
    }
  };

  const trackClick = async (campaignId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("promo_impressions").insert({
      campaign_id: campaignId,
      user_id: user?.id || null,
      placement,
      clicked: true,
    });
  };

  if (campaigns.length === 0 || dismissed) return null;

  const campaign = campaigns[currentIndex];

  if (placement === "tracking") {
    return (
      <div className={cn("relative rounded-lg overflow-hidden bg-gradient-to-r from-primary/10 to-accent/10 border", className)}>
        <div className="flex items-center gap-3 p-3">
          <Megaphone className="h-4 w-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{campaign.title}</p>
            {campaign.venue_name && (
              <p className="text-xs text-muted-foreground">at {campaign.venue_name}</p>
            )}
          </div>
          {campaign.cta_text && campaign.cta_link && (
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 text-xs"
              onClick={() => {
                trackClick(campaign.id);
                window.open(campaign.cta_link!, "_blank");
              }}
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
    <div className={cn("relative", className)}>
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
        <CardContent className="p-0">
          {campaign.banner_image_url && (
            <div className="relative h-32 w-full overflow-hidden">
              <img
                src={campaign.banner_image_url}
                alt={campaign.title}
                className="w-full h-full object-cover"
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
                  <VenueLogo logoUrl={campaign.venue_logo} venueName={campaign.venue_name || ""} size="sm" />
                )}
                {campaign.venue_name && (
                  <span className="text-sm font-medium">{campaign.venue_name}</span>
                )}
              </div>
              
              {campaign.cta_text && campaign.cta_link && (
                <Button
                  size="sm"
                  onClick={() => {
                    trackClick(campaign.id);
                    window.open(campaign.cta_link!, "_blank");
                  }}
                >
                  {campaign.cta_text}
                </Button>
              )}
            </div>
          </div>

          {/* Carousel dots */}
          {campaigns.length > 1 && (
            <div className="flex items-center justify-center gap-1.5 pb-3">
              {campaigns.map((_, i) => (
                <button
                  key={i}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    i === currentIndex ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30"
                  )}
                  onClick={() => setCurrentIndex(i)}
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
