import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Users, Clock, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface WaitlistEntry {
  id: string;
  venue: string;
  partySize: number;
  position: number;
  eta: number; // minutes
  preferences?: string[];
  status: "waiting" | "ready" | "seated";
}

export function TableReadyFlow({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<"venue-select" | "party-details" | "waiting" | "ready">("venue-select");
  const [selectedVenue, setSelectedVenue] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [preferences, setPreferences] = useState<string[]>([]);
  const [waitlistEntry, setWaitlistEntry] = useState<WaitlistEntry | null>(null);

  const mockVenues = [
    { name: "Joe's Burger Bar", waitTime: "15-20 min", tables: 3 },
    { name: "Mama's Pizza Kitchen", waitTime: "10-15 min", tables: 1 },
    { name: "The Coffee Spot", waitTime: "5-10 min", tables: 0 },
    { name: "Sushi Express", waitTime: "20-25 min", tables: 5 }
  ];

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

  const handleJoinWaitlist = () => {
    const entry: WaitlistEntry = {
      id: Math.random().toString(36).substr(2, 9),
      venue: selectedVenue,
      partySize,
      position: 3,
      eta: 18,
      preferences,
      status: "waiting"
    };
    setWaitlistEntry(entry);
    setStep("waiting");

    // Simulate waitlist progression
    setTimeout(() => {
      setWaitlistEntry(prev => prev ? { ...prev, position: 2, eta: 12 } : null);
    }, 4000);

    setTimeout(() => {
      setWaitlistEntry(prev => prev ? { ...prev, position: 1, eta: 5 } : null);
    }, 8000);

    setTimeout(() => {
      setWaitlistEntry(prev => prev ? { ...prev, status: "ready", eta: 0 } : null);
      setStep("ready");
    }, 12000);
  };

  const handleConfirmSeat = () => {
    setWaitlistEntry(prev => prev ? { ...prev, status: "seated" } : null);
    setTimeout(() => {
      onBack();
    }, 2000);
  };

  if (step === "venue-select") {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-2xl font-bold">Table Ready</h1>
        </div>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Select Restaurant</CardTitle>
            <p className="text-muted-foreground">Choose where you'd like to dine</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {mockVenues.map((venue) => (
              <Button
                key={venue.name}
                variant="outline"
                className="w-full justify-between h-16 p-4"
                onClick={() => handleVenueSelect(venue.name)}
              >
                <div className="text-left">
                  <div className="font-semibold">{venue.name}</div>
                  <div className="text-sm text-muted-foreground">Wait: {venue.waitTime}</div>
                </div>
                <Badge variant={venue.tables > 0 ? "secondary" : "destructive"}>
                  {venue.tables} tables ahead
                </Badge>
              </Button>
            ))}
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

            <Button onClick={handleJoinWaitlist} className="w-full h-12">
              Join Waitlist
            </Button>
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
              <span className="font-semibold">~{waitlistEntry.eta} min wait</span>
            </div>

            <div className="p-4 bg-muted rounded-xl">
              <div className="text-sm text-muted-foreground space-y-1">
                <div>📍 {waitlistEntry.venue}</div>
                <div>👥 Party of {waitlistEntry.partySize}</div>
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
              <p className="text-sm text-muted-foreground mt-1">Party of {waitlistEntry.partySize}</p>
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