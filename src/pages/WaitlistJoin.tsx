import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function WaitlistJoin() {
  const { venueId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [venue, setVenue] = useState<{ name: string; address?: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [partySize, setPartySize] = useState(2);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  useEffect(() => {
    const fetchVenue = async () => {
      if (!venueId) {
        navigate("/");
        return;
      }

      const { data, error } = await supabase
        .from("venues")
        .select("name, address")
        .eq("id", venueId)
        .single();

      if (error || !data) {
        toast({
          title: "Error",
          description: "Venue not found",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      setVenue(data);
      setIsLoading(false);
    };

    fetchVenue();
  }, [venueId, navigate, toast]);

  const handleJoinWaitlist = async () => {
    if (!customerName.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter your name",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    const { data, error } = await supabase
      .from("waitlist_entries")
      .insert({
        venue_id: venueId,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim() || null,
        party_size: partySize,
        status: "waiting",
        eta: new Date(Date.now() + 20 * 60000).toISOString(),
      })
      .select()
      .single();

    setIsSubmitting(false);

    if (error || !data) {
      toast({
        title: "Error",
        description: "Could not join waitlist. Please try again.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Added to Waitlist!",
      description: "You'll be notified when your table is ready.",
    });

    // Navigate to patron app to track the waitlist
    navigate("/");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-md shadow-card">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-primary">
            Join Waitlist
          </CardTitle>
          <p className="text-lg font-semibold">{venue?.name}</p>
          {venue?.address && (
            <p className="text-sm text-muted-foreground">{venue.address}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              placeholder="Your name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number (Optional)</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+1 (555) 123-4567"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
            />
          </div>

          <div className="space-y-3">
            <Label>Party Size</Label>
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPartySize(Math.max(1, partySize - 1))}
                disabled={partySize <= 1}
              >
                -
              </Button>
              <div className="flex items-center gap-2 text-lg font-semibold min-w-[80px] justify-center">
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

          <Button
            onClick={handleJoinWaitlist}
            disabled={isSubmitting || !customerName.trim()}
            className="w-full h-12"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 animate-spin" size={16} />
                Joining...
              </>
            ) : (
              "Join Waitlist"
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            You'll be able to track your position in real-time
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
