import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { VenueLogo } from "@/components/VenueLogo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ArrowLeft, 
  MapPin, 
  Star, 
  Clock, 
  Users, 
  Sparkles, 
  Filter,
  RefreshCw,
  Search,
  ChevronRight,
  Loader2,
  MessageSquare,
  Navigation,
  Pencil,
  X,
  Share2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PatronBusynessIndicator } from "@/components/PatronBusynessIndicator";
import { Messenger } from "@/components/Messenger";
import { PromoBanner } from "@/components/PromoBanner";
import { FriendsAtVenue } from "@/components/FriendsAtVenue";
import { cn } from "@/lib/utils";

interface VenueRecommendation {
  venue_id: string;
  name: string;
  match_score: number;
  busyness: "quiet" | "moderate" | "busy" | "very_busy";
  avg_rating: number;
  wait_estimate: string;
  distance_km: number | null;
  ai_reason: string;
  cuisine_types: string[];
  dietary_certifications: {
    halaal?: boolean;
    vegetarian_friendly?: boolean;
    vegan_options?: boolean;
    kosher?: boolean;
    gluten_free_options?: boolean;
  };
  address?: string;
  logo_url?: string | null;
}

interface LocationSuggestion {
  lat: number;
  lng: number;
  label: string;
  precision?: string;
}

const FILTER_OPTION_IDS = [
  { id: "halaal", labelKey: "explore.halaal", icon: "🕌" },
  { id: "vegetarian", labelKey: "explore.vegetarian", icon: "🥬" },
  { id: "vegan", labelKey: "explore.vegan", icon: "🌱" },
  { id: "short_wait", labelKey: "explore.shortWait", icon: "⚡" },
];

const RADIUS_OPTIONS = [10, 25, 50, 100];

interface ExploreVenuesProps {
  onBack: () => void;
  onSelectVenue?: (venueId: string) => void;
  initialVenueId?: string;
}

export function ExploreVenues({ onBack, onSelectVenue, initialVenueId }: ExploreVenuesProps) {
  const { t } = useTranslation();
  const [recommendations, setRecommendations] = useState<VenueRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const { toast } = useToast();
  
  // Location & radius state
  const [searchRadius, setSearchRadius] = useState<number>(() => {
    const saved = localStorage.getItem("explore_radius");
    return saved ? parseInt(saved, 10) : 25;
  });
  const [customLocation, setCustomLocation] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const [showLocationSearch, setShowLocationSearch] = useState(false);
  const [locationQuery, setLocationQuery] = useState("");
  const [searchingLocation, setSearchingLocation] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [locationSearchDone, setLocationSearchDone] = useState(false);
  
  // Messenger state for venue inquiries
  const [messengerOpen, setMessengerOpen] = useState(false);
  const [selectedVenueForChat, setSelectedVenueForChat] = useState<{ id: string; name: string; inquiryId?: string } | null>(null);
  const [creatingInquiry, setCreatingInquiry] = useState<string | null>(null);
  const [directSearchResults, setDirectSearchResults] = useState<VenueRecommendation[]>([]);
  const [searchingVenues, setSearchingVenues] = useState(false);
  const highlightRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to highlighted venue from promo
  useEffect(() => {
    if (initialVenueId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [initialVenueId, loading]);

  // The active coordinates used for searching
  const activeCoords = useMemo(
    () => (customLocation ? { lat: customLocation.lat, lng: customLocation.lng } : userLocation),
    [customLocation, userLocation]
  );

  useEffect(() => {
    checkAuth();
    getUserLocation();
  }, []);

  useEffect(() => {
    if (user !== undefined) {
      fetchRecommendations();
    }
  }, [user, activeCoords, searchRadius]);

  useEffect(() => {
    if (!showLocationSearch) {
      setLocationSuggestions([]);
      setSearchingLocation(false);
      return;
    }

    const query = locationQuery.trim();
    if (query.length < 2) {
      setLocationSuggestions([]);
      setSearchingLocation(false);
      setLocationSearchDone(false);
      return;
    }

    let cancelled = false;
    setLocationSearchDone(false);
    const timeoutId = window.setTimeout(async () => {
      setSearchingLocation(true);

      try {
        const { data, error } = await supabase.functions.invoke("validate-address", {
          body: { address: query, limit: 5 },
        });

        if (cancelled) return;

        if (error) {
          console.error("Location suggestions error:", error);
          setLocationSuggestions([]);
          return;
        }

        const suggestions = Array.isArray(data?.suggestions)
          ? data.suggestions
              .map((suggestion: any) => ({
                lat: suggestion.latitude,
                lng: suggestion.longitude,
                label: suggestion.formatted_address,
                precision: suggestion.precision,
              }))
              .filter((suggestion: LocationSuggestion) => Boolean(suggestion.label))
          : [];

        setLocationSuggestions(suggestions);
      } catch (error) {
        if (!cancelled) {
          console.error("Location suggestions error:", error);
          setLocationSuggestions([]);
        }
      } finally {
        if (!cancelled) {
          setSearchingLocation(false);
          setLocationSearchDone(true);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [locationQuery, showLocationSearch]);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
  };

  const getUserLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.log("Geolocation error:", error);
        }
      );
    }
  };

  const handleRadiusChange = (radius: number) => {
    setSearchRadius(radius);
    localStorage.setItem("explore_radius", radius.toString());
  };

  const applyCustomLocation = (location: LocationSuggestion) => {
    setCustomLocation({
      lat: location.lat,
      lng: location.lng,
      label: location.label,
    });
    setShowLocationSearch(false);
    setLocationQuery("");
    setLocationSuggestions([]);
  };

  const handleLocationSearch = async (selectedSuggestion?: LocationSuggestion) => {
    if (selectedSuggestion) {
      applyCustomLocation(selectedSuggestion);
      return;
    }

    if (locationSuggestions.length > 0) {
      applyCustomLocation(locationSuggestions[0]);
      return;
    }

    if (!locationQuery.trim()) return;
    setSearchingLocation(true);
    try {
      const { data, error } = await supabase.functions.invoke("validate-address", {
        body: { address: locationQuery.trim(), limit: 5 },
      });
      if (error || !data?.valid) {
        setLocationSuggestions([]);
        toast({
          title: "Location not found",
          description: "Try a different city or address",
          variant: "destructive",
        });
      } else {
        applyCustomLocation({
          lat: data.latitude,
          lng: data.longitude,
          label: data.formatted_address || locationQuery.trim(),
          precision: data.precision,
        });
      }
    } catch (err) {
      console.error("Location search error:", err);
    } finally {
      setSearchingLocation(false);
    }
  };

  const clearCustomLocation = () => {
    setCustomLocation(null);
    setShowLocationSearch(false);
    setLocationQuery("");
    setLocationSuggestions([]);
  };

  const fetchRecommendations = async () => {
    setLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke("get-venue-recommendations", {
        body: {
          user_id: user?.id || null,
          location: activeCoords,
          filters: activeFilters.length > 0 ? activeFilters : undefined,
          radius_km: activeCoords ? searchRadius : undefined,
        },
      });

      if (error) {
        console.error("Error fetching recommendations:", error);
        toast({
          title: "Error",
          description: "Failed to load recommendations",
          variant: "destructive",
        });
      } else {
        setRecommendations(data?.recommendations || []);
      }
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchRecommendations();
    setRefreshing(false);
  };

  const toggleFilter = (filterId: string) => {
    setActiveFilters((prev) =>
      prev.includes(filterId) 
        ? prev.filter((f) => f !== filterId) 
        : [...prev, filterId]
    );
  };

  const handleMessageVenue = async (venue: VenueRecommendation, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to message venues",
        variant: "destructive",
      });
      return;
    }
    
    setCreatingInquiry(venue.venue_id);
    
    try {
      // Check if inquiry already exists
      const { data: existing } = await (supabase
        .from('venue_inquiries') as any)
        .select('id')
        .eq('venue_id', venue.venue_id)
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (existing) {
        // Use existing inquiry
        setSelectedVenueForChat({ id: venue.venue_id, name: venue.name, inquiryId: existing.id });
        setMessengerOpen(true);
      } else {
        // Create new inquiry
        const { data: newInquiry, error } = await (supabase
          .from('venue_inquiries') as any)
          .insert({
            venue_id: venue.venue_id,
            user_id: user.id,
            status: 'open'
          })
          .select('id')
          .single();
        
        if (error) {
          console.error('Error creating inquiry:', error);
          toast({
            title: "Error",
            description: "Failed to start conversation",
            variant: "destructive",
          });
        } else {
          setSelectedVenueForChat({ id: venue.venue_id, name: venue.name, inquiryId: newInquiry.id });
          setMessengerOpen(true);
        }
      }
    } catch (err) {
      console.error('Error:', err);
      toast({
        title: "Error",
        description: "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setCreatingInquiry(null);
    }
  };

  // Direct venue name search when user types a query
  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length < 2) {
      setDirectSearchResults([]);
      setSearchingVenues(false);
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      setSearchingVenues(true);
      try {
        const { data: venues, error } = await supabase
          .from("venues")
          .select("id, name, address, display_address, latitude, longitude, settings, logo_url")
          .ilike("name", `%${query}%`)
          .limit(10);

        if (cancelled || error) return;

        // Convert to VenueRecommendation format, excluding already-recommended venues
        const existingIds = new Set(recommendations.map((r) => r.venue_id));
        const extras: VenueRecommendation[] = (venues || [])
          .filter((v) => !existingIds.has(v.id))
          .map((v) => {
            const settings = v.settings as any;
            const attrs = settings?.venue_attributes || {};
            return {
              venue_id: v.id,
              name: v.name,
              match_score: 0,
              busyness: "quiet" as const,
              avg_rating: 0,
              wait_estimate: "",
              distance_km: null,
              ai_reason: "",
              cuisine_types: attrs.cuisine_types || [],
              dietary_certifications: attrs.dietary_certifications || {},
              address: v.display_address || v.address || undefined,
              logo_url: v.logo_url,
            };
          });

        setDirectSearchResults(extras);
      } catch (err) {
        console.error("Direct search error:", err);
      } finally {
        if (!cancelled) setSearchingVenues(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [searchQuery, recommendations]);

  const filteredRecommendations = recommendations.filter((venue) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesName = venue.name.toLowerCase().includes(query);
      const matchesCuisine = venue.cuisine_types?.some((c) => 
        c.toLowerCase().includes(query)
      );
      if (!matchesName && !matchesCuisine) return false;
    }

    // Active filters
    for (const filter of activeFilters) {
      if (filter === "halaal" && !venue.dietary_certifications?.halaal) return false;
      if (filter === "vegetarian" && !venue.dietary_certifications?.vegetarian_friendly) return false;
      if (filter === "vegan" && !venue.dietary_certifications?.vegan_options) return false;
      if (filter === "short_wait" && venue.busyness !== "quiet" && venue.busyness !== "moderate") return false;
    }

    return true;
  });

  // Merge direct search results with filtered recommendations
  const allDisplayedVenues = searchQuery.trim().length >= 2
    ? [...filteredRecommendations, ...directSearchResults]
    : filteredRecommendations;

  const getBusynessColor = (busyness: string) => {
    switch (busyness) {
      case "quiet": return "text-success";
      case "moderate": return "text-amber-500";
      case "busy": return "text-orange-500";
      case "very_busy": return "text-destructive";
      default: return "text-muted-foreground";
    }
  };

  const getBusynessLabel = (busyness: string) => {
    switch (busyness) {
      case "quiet": return t("explore.notBusy");
      case "moderate": return t("explore.moderatelyBusy");
      case "busy": return t("explore.busy");
      case "very_busy": return t("explore.veryBusy");
      default: return t("explore.unknown");
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24" data-tour="explore-content">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        <div className="flex items-center gap-4 p-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">{t("explore.title")}</h1>
            <p className="text-sm text-muted-foreground">
              {user ? t("explore.personalised") : t("explore.discover")}
            </p>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={cn("h-5 w-5", refreshing && "animate-spin")} />
          </Button>
        </div>

        {/* Search */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("explore.searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Location bar */}
        <div className="px-4 pb-3 space-y-2">
          {showLocationSearch ? (
            <>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t("explore.locationPlaceholder")}
                    value={locationQuery}
                    onChange={(e) => setLocationQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleLocationSearch()}
                    className="pl-9 pr-10"
                    autoFocus
                  />
                  {searchingLocation && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => {
                    setShowLocationSearch(false);
                    setLocationQuery("");
                    setLocationSuggestions([]);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="overflow-hidden rounded-lg border border-border bg-card">
                {locationSuggestions.length > 0 ? (
                  locationSuggestions.map((suggestion) => (
                    <button
                      key={`${suggestion.label}-${suggestion.lat}-${suggestion.lng}`}
                      type="button"
                      onClick={() => handleLocationSearch(suggestion)}
                      className="flex w-full items-start gap-3 border-b border-border px-3 py-3 text-left transition-colors hover:bg-muted/50 last:border-b-0"
                    >
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{suggestion.label}</p>
                        {suggestion.precision && (
                          <p className="text-xs capitalize text-muted-foreground">
                            {suggestion.precision.replace("_", " ")}
                          </p>
                        )}
                      </div>
                    </button>
                  ))
              ) : locationQuery.trim().length >= 2 && !searchingLocation && locationSearchDone ? (
                  <div className="px-3 py-4 text-sm text-muted-foreground">
                    {t("explore.noLocationsFound")}
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 text-sm">
              <Navigation className="h-4 w-4 text-primary shrink-0" />
              {customLocation ? (
                <>
                  <span className="text-muted-foreground">{t("explore.searchingIn")}</span>
                  <span className="font-medium truncate">{customLocation.label}</span>
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setShowLocationSearch(true)}>
                    <Pencil className="h-3 w-3 mr-1" />
                    {t("explore.change")}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={clearCustomLocation}>
                    <X className="h-3 w-3" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="text-muted-foreground">
                    {userLocation ? t("explore.usingLocation") : t("explore.locationUnavailable")}
                  </span>
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setShowLocationSearch(true)}>
                    <Pencil className="h-3 w-3 mr-1" />
                    {t("explore.change")}
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Radius chips */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{t("explore.radius")}</span>
            {RADIUS_OPTIONS.map((r) => (
              <button
                key={r}
                onClick={() => handleRadiusChange(r)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-xs font-medium transition-all border",
                  searchRadius === r
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/50 border-border hover:border-primary/50"
                )}
              >
                {r}km
              </button>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="px-4 pb-4 flex gap-2 overflow-x-auto no-scrollbar">
          {FILTER_OPTION_IDS.map((filter) => {
            const isActive = activeFilters.includes(filter.id);
            return (
              <button
                key={filter.id}
                onClick={() => toggleFilter(filter.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm whitespace-nowrap transition-all",
                  isActive 
                    ? "bg-primary text-primary-foreground border-primary" 
                    : "bg-muted/50 border-border hover:border-primary/50"
                )}
              >
                <span>{filter.icon}</span>
                <span>{t(filter.labelKey)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Login prompt for personalization */}
      {!user && !loading && (
        <div className="mx-4 mt-4">
          <Card className="bg-gradient-to-br from-primary/10 to-background border-primary/20">
            <CardContent className="p-4 flex items-center gap-3">
              <Sparkles className="h-8 w-8 text-primary" />
              <div className="flex-1">
                <p className="font-medium text-sm">{t("explore.getPersonalized")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("explore.signInSetPrefs")}
                </p>
              </div>
              <Button size="sm" variant="default">
                {t("common.signIn")}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Promoted Venues Banner */}
      <div className="px-4 pt-4">
        <PromoBanner placement="explore" onNavigateToVenue={(venueId) => onSelectVenue?.(venueId)} />
      </div>

      {/* Recommendations */}
      <div className="p-4 space-y-4">
        {user && !loading && recommendations.length > 0 && (
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">{t("explore.forYou")}</span>
          </div>
        )}

        {loading ? (
          // Loading skeletons
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="shadow-card">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <Skeleton className="h-8 w-16 rounded-full" />
                </div>
                <Skeleton className="h-12 w-full" />
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : allDisplayedVenues.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <MapPin className="h-10 w-10 text-muted-foreground mx-auto" />
            <p className="text-muted-foreground font-medium">
              {customLocation
                ? t("explore.noVenuesNear", { location: customLocation.label })
                : recommendations.length === 0
                  ? t("explore.noVenuesArea")
                  : t("explore.noVenuesMatch")}
            </p>
            <p className="text-sm text-muted-foreground">
              {customLocation
                ? t("explore.tryDifferentLocation")
                : recommendations.length === 0
                  ? t("explore.tryIncreaseRadius")
                  : t("explore.tryAdjustFilters")}
            </p>
            {activeFilters.length > 0 && (
              <Button 
                variant="link" 
                onClick={() => setActiveFilters([])}
              >
                {t("explore.clearFilters")}
              </Button>
            )}
            {searchRadius < 100 && recommendations.length === 0 && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleRadiusChange(100)}
              >
                {t("explore.expandTo", { radius: 100 })}
              </Button>
            )}
          </div>
        ) : (
          allDisplayedVenues.map((venue) => (
            <Card 
              key={venue.venue_id}
              ref={venue.venue_id === initialVenueId ? highlightRef : undefined}
              className={cn(
                "shadow-card cursor-pointer transition-all hover:shadow-floating hover:scale-[1.01] active:scale-[0.99] relative",
                venue.venue_id === initialVenueId && "ring-2 ring-primary"
              )}
              onClick={() => onSelectVenue?.(venue.venue_id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3 flex-1">
                    <VenueLogo logoUrl={venue.logo_url} name={venue.name} size="lg" />
                    <div>
                      <h3 className="font-semibold text-lg">{venue.name}</h3>
                    {venue.address && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                        <MapPin className="h-3 w-3" />
                        <span className="truncate max-w-[200px]">{venue.address}</span>
                        {venue.distance_km !== null && (
                          <span className="ml-1">• {venue.distance_km.toFixed(1)} km</span>
                        )}
                      </div>
                    )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Share button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        const url = `${window.location.origin}/waitlist/${venue.venue_id}`;
                        if (navigator.share) {
                          navigator.share({
                            title: venue.name,
                            text: t("explore.shareVenue", { name: venue.name }),
                            url,
                          }).catch(() => {});
                        } else {
                          navigator.clipboard.writeText(url);
                          toast({ title: t("explore.linkCopied") });
                        }
                      }}
                    >
                      <Share2 className="h-4 w-4" />
                    </Button>
                    {/* Message button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => handleMessageVenue(venue, e)}
                      disabled={creatingInquiry === venue.venue_id}
                    >
                      {creatingInquiry === venue.venue_id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <MessageSquare className="h-4 w-4" />
                      )}
                    </Button>
                    {user && venue.match_score > 0 && (
                      <Badge 
                        variant="default" 
                        className={cn(
                          "text-sm font-bold",
                          venue.match_score >= 80 && "bg-success text-success-foreground",
                          venue.match_score >= 60 && venue.match_score < 80 && "bg-primary text-primary-foreground",
                          venue.match_score < 60 && "bg-muted text-muted-foreground"
                        )}
                      >
                        {t("explore.match", { score: venue.match_score })}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* AI Reason */}
                {venue.ai_reason && (
                  <div className="bg-muted/50 rounded-lg p-3 mb-3 flex items-start gap-2">
                    <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <p className="text-sm text-muted-foreground">{venue.ai_reason}</p>
                  </div>
                )}

                {/* Stats row */}
                <div className="flex items-center gap-4 text-sm mb-3">
                  {venue.avg_rating > 0 && (
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                      <span className="font-medium">{venue.avg_rating.toFixed(1)}</span>
                    </div>
                  )}
                  <div className={cn("flex items-center gap-1", getBusynessColor(venue.busyness))}>
                    <Users className="h-4 w-4" />
                    <span>{getBusynessLabel(venue.busyness)}</span>
                  </div>
                  {venue.wait_estimate && (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>{venue.wait_estimate}</span>
                    </div>
                  )}
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5">
                  {venue.cuisine_types?.slice(0, 3).map((cuisine) => (
                    <Badge key={cuisine} variant="secondary" className="text-xs capitalize">
                      {cuisine.replace("_", " ")}
                    </Badge>
                  ))}
                  {venue.dietary_certifications?.halaal && (
                    <Badge variant="outline" className="text-xs">🕌 {t("explore.halaal")}</Badge>
                  )}
                  {venue.dietary_certifications?.vegetarian_friendly && (
                    <Badge variant="outline" className="text-xs">🥬 {t("explore.vegFriendly")}</Badge>
                  )}
                  {venue.dietary_certifications?.vegan_options && (
                    <Badge variant="outline" className="text-xs">🌱 {t("explore.veganOptions")}</Badge>
                  )}
                </div>

                {/* Friends at venue badge */}
                {user && <FriendsAtVenue venueId={venue.venue_id} userId={user.id} />}

                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <ChevronRight className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Messenger for venue inquiries */}
      {selectedVenueForChat && (
        <Messenger
          open={messengerOpen}
          onOpenChange={(open) => {
            setMessengerOpen(open);
            if (!open) setSelectedVenueForChat(null);
          }}
          venueInquiryId={selectedVenueForChat.inquiryId}
          userType="patron"
          userId={user?.id || ''}
          venueName={selectedVenueForChat.name}
        />
      )}
    </div>
  );
}
