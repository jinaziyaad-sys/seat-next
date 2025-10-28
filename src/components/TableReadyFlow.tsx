import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Users, Clock, CheckCircle, Search, MapPin, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

interface WaitlistEntry {
  id: string;
  venue: string;
  party_size: number;
  position: number;
  eta: string | null;
  preferences?: string[];
  status: "waiting" | "ready" | "seated" | "cancelled" | "no_show";
}

const partyDetailsSchema = z.object({
  partyName: z.string().trim().min(1, "Party name is required").max(50, "Party name must be less than 50 characters"),
  partySize: z.number().int().min(1, "Party size must be at least 1").max(12, "Party size cannot exceed 12"),
});

export function TableReadyFlow({ onBack, initialEntry }: { onBack: () => void; initialEntry?: any }) {
  const { toast } = useToast();
  const [step, setStep] = useState<"venue-select" | "party-details" | "waiting" | "ready">("venue-select");
  const [selectedVenue, setSelectedVenue] = useState("");
  const [partyName, setPartyName] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [preferences, setPreferences] = useState<string[]>([]);
  const [waitlistEntry, setWaitlistEntry] = useState<WaitlistEntry | null>(null);
  const [venues, setVenues] = useState<{id: string; name: string; address?: string; waitTime?: string; tables?: number}[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get authenticated user
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    getUser();
  }, []);

  // Handle initial entry from home page
  useEffect(() => {
    if (initialEntry) {
      const entry: WaitlistEntry = {
        id: initialEntry.id,
        venue: initialEntry.venues?.name || "",
        party_size: initialEntry.party_size,
        position: initialEntry.position || 3,
        eta: initialEntry.eta,
        preferences: initialEntry.preferences || [],
        status: initialEntry.status
      };
      setWaitlistEntry(entry);
      setStep(initialEntry.status === "ready" ? "ready" : "waiting");

      // Set up real-time subscription
      const channel = supabase
        .channel(`waitlist-${initialEntry.id}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'waitlist_entries',
          filter: `id=eq.${initialEntry.id}`
        }, (payload) => {
          if (payload.new) {
            setWaitlistEntry(prev => prev ? {
              ...prev,
              status: payload.new.status,
              eta: payload.new.eta,
              position: payload.new.position
            } : null);
            
            if (payload.new.status === "ready") {
              setStep("ready");
            }
          }
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [initialEntry]);

  // Fetch venues on component mount
  useEffect(() => {
    const fetchVenues = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("venues")
        .select("id, name, address")
        .order("name");
      
      if (data && !error) {
        // Add mock wait times for display
        const venuesWithWait = data.map(venue => ({
          ...venue,
          waitTime: "15-20 min",
          tables: Math.floor(Math.random() * 5)
        }));
        setVenues(venuesWithWait);
      }
      setIsLoading(false);
    };

    fetchVenues();
  }, []);

  const filteredVenues = venues.filter(venue => 
    venue.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (venue.address && venue.address.toLowerCase().includes(searchQuery.toLowerCase()))
  );


  const preferenceOptions = [
    "Indoor seating",
    "Outdoor seating", 
    "Smoking section",
    "High chair needed",
    "Wheelchair accessible"
  ];

  const handleVenueSelect = (venue: string) => {
    setSelectedVenue(venue);
    setStep("party-details");
  };

  const togglePreference = (pref: string) => {
    setPreferences(prev => 
      prev.includes(pref) 
        ? prev.filter(p => p !== pref)
        : [...prev, pref]
    );
  };

  const handleJoinWaitlist = async () => {
    // Check if user is authenticated
    if (!userId) {
      toast({
        title: "Registration Required",
        description: "Please create an account to join the waitlist and track your position.",
        variant: "default",
        action: (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => window.location.href = '/auth'}
          >
            Sign Up
          </Button>
        ),
      });
      return;
    }

    // Validate inputs
    const validation = partyDetailsSchema.safeParse({ partyName, partySize });
    if (!validation.success) {
      toast({
        title: "Validation Error",
        description: validation.error.errors[0].message,
        variant: "destructive"
      });
      return;
    }
    
    const venue = venues.find(v => v.name === selectedVenue);
    if (!venue) {
      toast({
        title: "Error",
        description: "Selected venue not found. Please try again.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: newEntry, error } = await supabase
        .from("waitlist_entries")
        .insert({
          venue_id: venue.id,
          customer_name: partyName.trim(),
          party_size: partySize,
          preferences,
          eta: new Date(Date.now() + 18 * 60000).toISOString(),
          status: "waiting",
          user_id: userId
        })
        .select()
        .single();

      if (error) {
        console.error("Error joining waitlist:", error);
        toast({
          title: "Failed to Join Waitlist",
          description: error.message || "Unable to add you to the waitlist. Please try again.",
          variant: "destructive"
        });
        return;
      }

      if (newEntry) {
        const entry: WaitlistEntry = {
          id: newEntry.id,
          venue: selectedVenue,
          party_size: newEntry.party_size,
          position: 3, // Could be calculated from actual waitlist
          eta: newEntry.eta,
          preferences: newEntry.preferences || [],
          status: newEntry.status
        };
        setWaitlistEntry(entry);
        
        toast({
          title: "Added to Waitlist!",
          description: `You've been added to the waitlist at ${selectedVenue}.`
        });
        
        setStep("waiting");

        // Set up real-time subscription for this entry
        const channel = supabase
          .channel(`waitlist-${newEntry.id}`)
          .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'waitlist_entries', 
            filter: `id=eq.${newEntry.id}`
          }, (payload) => {
            if (payload.new) {
              setWaitlistEntry(prev => prev ? {
                ...prev,
                status: payload.new.status,
                eta: payload.new.eta
              } : null);
              
              if (payload.new.status === "ready") {
                setStep("ready");
              }
            }
          })
          .subscribe();

        return () => supabase.removeChannel(channel);
      }
    } catch (err) {
      console.error("Unexpected error:", err);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelBooking = async () => {
    if (!waitlistEntry) return;

    const { error } = await supabase
      .from("waitlist_entries")
      .update({ status: "cancelled" })
      .eq("id", waitlistEntry.id);

    if (!error) {
      setWaitlistEntry(prev => prev ? { ...prev, status: "cancelled" } : null);
      setTimeout(() => {
        onBack();
      }, 1500);
    }
  };

  const handleConfirmSeat = async () => {
    if (!waitlistEntry) return;

    const { error } = await supabase
      .from("waitlist_entries")
      .update({ status: "seated" })
      .eq("id", waitlistEntry.id);

    if (!error) {
      setWaitlistEntry(prev => prev ? { ...prev, status: "seated" } : null);
      setTimeout(() => {
        onBack();
      }, 2000);
    }
  };

  if (step === "venue-select") {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-2xl font-bold">Join Waitlist</h1>
        </div>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Select Restaurant</CardTitle>
            <p className="text-muted-foreground">Search and choose where you'd like to dine</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <Input
                placeholder="Search restaurants..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading venues...</div>
            ) : filteredVenues.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? "No venues found matching your search" : "No venues available"}
              </div>
            ) : (
              <div className="space-y-2 mt-4">
                <div className="text-sm text-muted-foreground">
                  {filteredVenues.length} {filteredVenues.length === 1 ? 'restaurant' : 'restaurants'} found
                </div>
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2"
                     style={{ scrollbarGutter: 'stable' }}>
                  {filteredVenues.map((venue) => (
                    <Card 
                      key={venue.id}
                      className="cursor-pointer hover:bg-accent transition-colors"
                      onClick={() => handleVenueSelect(venue.name)}
                    >
                      <CardContent className="p-4">
                        <div className="flex justify-between items-center gap-4">
                          <div className="flex flex-col gap-1 flex-1">
                            <span className="font-medium">{venue.name}</span>
                            {venue.address && (
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <MapPin size={14} />
                                <span>{venue.address}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Clock size={14} />
                              <span>Wait: {venue.waitTime}</span>
                            </div>
                          </div>
                          <Badge variant={venue.tables && venue.tables > 0 ? "secondary" : "default"} className="shrink-0">
                            {venue.tables || 0} ahead
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "party-details") {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setStep("venue-select")}>
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-2xl font-bold">Party Details</h1>
        </div>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>{selectedVenue}</CardTitle>
            <p className="text-muted-foreground">Tell us about your party</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <label className="text-sm font-medium">Party Name</label>
              <Input
                placeholder="e.g. Smith, John, Party of 4..."
                value={partyName}
                onChange={(e) => setPartyName(e.target.value)}
                className="h-12"
                maxLength={50}
              />
              <p className="text-xs text-muted-foreground">
                We'll use this name to call your party when your table is ready
              </p>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium">Party Size</label>
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPartySize(Math.max(1, partySize - 1))}
                  disabled={partySize <= 1}
                >
                  -
                </Button>
                <div className="flex items-center gap-2 text-lg font-semibold">
                  <Users size={20} />
                  <span>{partySize}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPartySize(Math.min(12, partySize + 1))}
                  disabled={partySize >= 12}
                >
                  +
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium">Seating Preferences (Optional)</label>
              <div className="grid grid-cols-1 gap-2">
                {preferenceOptions.map((pref) => (
                  <Button
                    key={pref}
                    variant={preferences.includes(pref) ? "default" : "outline"}
                    size="sm"
                    className="justify-start"
                    onClick={() => togglePreference(pref)}
                  >
                    {pref}
                  </Button>
                ))}
              </div>
            </div>

            <Button 
              onClick={handleJoinWaitlist} 
              disabled={!partyName.trim() || isSubmitting}
              className="w-full h-12"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Joining...
                </>
              ) : (
                "Join Waitlist"
              )}
            </Button>
            {!partyName.trim() && (
              <p className="text-xs text-muted-foreground text-center">
                Please enter your party name to continue
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "waiting" && waitlistEntry) {
    return (
      <div className="space-y-6 p-6 pb-24">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-2xl font-bold">Waitlist Status</h1>
        </div>

        <Card className="shadow-card">
          <CardContent className="p-8 text-center space-y-6">
            <div className="text-6xl">⏰</div>
            
            <div className="space-y-2">
              <h2 className="text-3xl font-bold text-primary">#{waitlistEntry.position}</h2>
              <p className="text-lg text-muted-foreground">in line</p>
            </div>

            <div className="flex items-center justify-center gap-2 text-lg">
              <Clock size={20} />
              <span className="font-semibold">
                ~{waitlistEntry.eta ? Math.ceil((new Date(waitlistEntry.eta).getTime() - new Date().getTime()) / (1000 * 60)) : 0} min wait
              </span>
            </div>

            <div className="p-4 bg-muted rounded-xl">
              <div className="text-sm text-muted-foreground space-y-1">
                <div>📍 {waitlistEntry.venue}</div>
                <div>👥 Party of {waitlistEntry.party_size}</div>
                {waitlistEntry.preferences && waitlistEntry.preferences.length > 0 && (
                  <div>✨ {waitlistEntry.preferences.join(", ")}</div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Live Updates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-primary"></div>
                <span>You joined the waitlist</span>
                <span className="text-muted-foreground ml-auto">Just now</span>
              </div>
              {waitlistEntry.position <= 2 && (
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-success"></div>
                  <span>Moved up in line</span>
                  <span className="text-muted-foreground ml-auto">2 min ago</span>
                </div>
              )}
              {waitlistEntry.position === 1 && (
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-warning"></div>
                  <span>Get ready! You're next</span>
                  <span className="text-muted-foreground ml-auto">Just now</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="p-4">
            <Button 
              variant="outline" 
              className="w-full h-12 text-destructive hover:bg-destructive/10"
              onClick={handleCancelBooking}
            >
              Cancel Booking
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "ready" && waitlistEntry) {
    return (
      <div className="space-y-6 p-6">
        <Card className="shadow-card">
          <CardContent className="p-8 text-center space-y-6">
            <div className="text-6xl">🎉</div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-primary">Your Table is Ready!</h2>
              <p className="text-muted-foreground">{waitlistEntry.venue}</p>
            </div>

            <div className="p-6 bg-primary/10 rounded-xl border border-primary/20">
              <p className="font-semibold text-primary">Please head to the host stand now</p>
              <p className="text-sm text-muted-foreground mt-1">Party of {waitlistEntry.party_size}</p>
            </div>

            <div className="space-y-3">
              <Button onClick={handleConfirmSeat} className="w-full h-12">
                I'm Here - Confirm Seating
              </Button>
              <Button variant="outline" className="w-full h-12">
                Need 5 More Minutes
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}