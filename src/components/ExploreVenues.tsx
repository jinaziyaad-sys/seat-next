import { useState, useEffect, useCallback } from "react";
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
  MessageSquare
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PatronBusynessIndicator } from "@/components/PatronBusynessIndicator";
import { Messenger } from "@/components/Messenger";
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
}

const FILTER_OPTIONS = [
  { id: "halaal", label: "Halaal", icon: "🕌" },
  { id: "vegetarian", label: "Vegetarian", icon: "🥬" },
  { id: "vegan", label: "Vegan", icon: "🌱" },
  { id: "short_wait", label: "Short Wait", icon: "⚡" },
];

interface ExploreVenuesProps {
  onBack: () => void;
  onSelectVenue?: (venueId: string) => void;
}

export function ExploreVenues({ onBack, onSelectVenue }: ExploreVenuesProps) {
  const [recommendations, setRecommendations] = useState<VenueRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const { toast } = useToast();
  
  // Messenger state for venue inquiries
  const [messengerOpen, setMessengerOpen] = useState(false);
  const [selectedVenueForChat, setSelectedVenueForChat] = useState<{ id: string; name: string; inquiryId?: string } | null>(null);
  const [creatingInquiry, setCreatingInquiry] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
    getUserLocation();
  }, []);

  useEffect(() => {
    if (user !== undefined) {
      fetchRecommendations();
    }
  }, [user, userLocation]);

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
          // Continue without location
        }
      );
    }
  };

  const fetchRecommendations = async () => {
    setLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke("get-venue-recommendations", {
        body: {
          user_id: user?.id || null,
          location: userLocation,
          filters: activeFilters.length > 0 ? activeFilters : undefined,
        },
      });

      if (error) {
        console.error("Error fetching recommendations:", error);
        toast({
          title: "Error",
          description: "Failed to load recommendations",
          variant: "destructive",
        });
      } else if (data?.recommendations) {
        setRecommendations(data.recommendations);
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
      case "quiet": return "Not busy";
      case "moderate": return "Moderately busy";
      case "busy": return "Busy";
      case "very_busy": return "Very busy";
      default: return "Unknown";
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
            <h1 className="text-xl font-bold">Explore Venues</h1>
            <p className="text-sm text-muted-foreground">
              {user ? "Personalized for you" : "Discover nearby restaurants"}
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
              placeholder="Search by name or cuisine..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Filters */}
        <div className="px-4 pb-4 flex gap-2 overflow-x-auto no-scrollbar">
          {FILTER_OPTIONS.map((filter) => {
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
                <span>{filter.label}</span>
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
                <p className="font-medium text-sm">Get personalized recommendations</p>
                <p className="text-xs text-muted-foreground">
                  Sign in and set your dining preferences
                </p>
              </div>
              <Button size="sm" variant="default">
                Sign In
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recommendations */}
      <div className="p-4 space-y-4">
        {user && !loading && recommendations.length > 0 && (
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">For You</span>
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
        ) : filteredRecommendations.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No venues match your filters</p>
            {activeFilters.length > 0 && (
              <Button 
                variant="link" 
                onClick={() => setActiveFilters([])}
                className="mt-2"
              >
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          filteredRecommendations.map((venue) => (
            <Card 
              key={venue.venue_id}
              className="shadow-card cursor-pointer transition-all hover:shadow-floating hover:scale-[1.01] active:scale-[0.99] relative"
              onClick={() => onSelectVenue?.(venue.venue_id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3 flex-1">
                    <VenueLogo logoUrl={(venue as any).logo_url} name={venue.name} size="lg" />
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
                  <div className="flex items-center gap-2">
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
                        {venue.match_score}% Match
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
                    <Badge variant="outline" className="text-xs">🕌 Halaal</Badge>
                  )}
                  {venue.dietary_certifications?.vegetarian_friendly && (
                    <Badge variant="outline" className="text-xs">🥬 Veg-friendly</Badge>
                  )}
                  {venue.dietary_certifications?.vegan_options && (
                    <Badge variant="outline" className="text-xs">🌱 Vegan options</Badge>
                  )}
                </div>

                {/* Action arrow */}
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
