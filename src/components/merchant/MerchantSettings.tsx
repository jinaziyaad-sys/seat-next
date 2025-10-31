import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus, X } from "lucide-react";

interface WaitlistPreference {
  id: string;
  label: string;
  enabled: boolean;
  custom?: boolean;
}

export const MerchantSettings = ({ venue, venueId }: { venue: string; venueId: string }) => {
  const [settings, setSettings] = useState({
    venueCapacity: "40",
    tablesPerInterval: "4",
    defaultPrepTime: "10",
    maxExtensionTime: "45",
    pickupInstructions: "Please collect your order from the main counter. Show your order number to staff.",
    autoNoShowTime: "15"
  });

  const [waitlistPreferences, setWaitlistPreferences] = useState<WaitlistPreference[]>([]);
  const [newPreferenceLabel, setNewPreferenceLabel] = useState("");

  const { toast } = useToast();

  useEffect(() => {
    const fetchVenueSettings = async () => {
      const { data, error } = await supabase
        .from("venues")
        .select("waitlist_preferences")
        .eq("id", venueId)
        .single();

      if (!error && data?.waitlist_preferences) {
        const prefs = data.waitlist_preferences as { options?: WaitlistPreference[] };
        if (prefs.options) {
          setWaitlistPreferences(prefs.options);
        }
      }
    };

    fetchVenueSettings();
  }, [venueId]);

  const handleSave = async () => {
    const { error } = await supabase
      .from("venues")
      .update({
        waitlist_preferences: { options: waitlistPreferences } as any
      })
      .eq("id", venueId);

    if (error) {
      toast({
        title: "Error",
        description: "Could not save settings",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Settings Saved",
      description: "Venue settings have been updated successfully.",
    });
  };

  const handleInputChange = (key: string, value: string | boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const togglePreference = (id: string) => {
    setWaitlistPreferences(prev =>
      prev.map(pref =>
        pref.id === id ? { ...pref, enabled: !pref.enabled } : pref
      )
    );
  };

  const addCustomPreference = () => {
    if (!newPreferenceLabel.trim()) return;

    const newPref: WaitlistPreference = {
      id: newPreferenceLabel.toLowerCase().replace(/\s+/g, '_'),
      label: newPreferenceLabel.trim(),
      enabled: true,
      custom: true
    };

    setWaitlistPreferences(prev => [...prev, newPref]);
    setNewPreferenceLabel("");
  };

  const removeCustomPreference = (id: string) => {
    setWaitlistPreferences(prev => prev.filter(pref => pref.id !== id));
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Venue Settings</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Capacity Settings */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Capacity & Pacing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="capacity">Total Venue Capacity</Label>
              <Input
                id="capacity"
                type="number"
                value={settings.venueCapacity}
                onChange={(e) => handleInputChange("venueCapacity", e.target.value)}
              />
              <p className="text-sm text-muted-foreground mt-1">
                Maximum number of guests the venue can accommodate
              </p>
            </div>

            <div>
              <Label htmlFor="pacing">Tables per 15-minute Interval</Label>
              <Input
                id="pacing"
                type="number"
                value={settings.tablesPerInterval}
                onChange={(e) => handleInputChange("tablesPerInterval", e.target.value)}
              />
              <p className="text-sm text-muted-foreground mt-1">
                How many tables can be seated every 15 minutes
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Kitchen Settings */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Kitchen Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="prepTime">Default Prep Time (minutes)</Label>
              <Input
                id="prepTime"
                type="number"
                value={settings.defaultPrepTime}
                onChange={(e) => handleInputChange("defaultPrepTime", e.target.value)}
              />
              <p className="text-sm text-muted-foreground mt-1">
                Default estimated preparation time for orders
              </p>
            </div>

            <div>
              <Label htmlFor="maxExtension">Maximum Extension Time (minutes)</Label>
              <Input
                id="maxExtension"
                type="number"
                value={settings.maxExtensionTime}
                onChange={(e) => handleInputChange("maxExtensionTime", e.target.value)}
              />
              <p className="text-sm text-muted-foreground mt-1">
                Maximum time an order ETA can be extended
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Waitlist Preferences */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Waitlist Preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground mb-4">
              Choose which seating preferences to display to customers when they join the waitlist
            </p>
            
            {waitlistPreferences.map((pref) => (
              <div key={pref.id} className="flex items-center justify-between">
                <div className="flex-1">
                  <Label htmlFor={pref.id}>{pref.label}</Label>
                  {pref.custom && (
                    <p className="text-xs text-muted-foreground">Custom option</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id={pref.id}
                    checked={pref.enabled}
                    onCheckedChange={() => togglePreference(pref.id)}
                  />
                  {pref.custom && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeCustomPreference(pref.id)}
                    >
                      <X size={16} />
                    </Button>
                  )}
                </div>
              </div>
            ))}

            <Separator className="my-4" />

            <div className="space-y-2">
              <Label htmlFor="newPreference">Add Custom Preference</Label>
              <div className="flex gap-2">
                <Input
                  id="newPreference"
                  placeholder="e.g., Kids Area, Window Seat"
                  value={newPreferenceLabel}
                  onChange={(e) => setNewPreferenceLabel(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addCustomPreference()}
                />
                <Button onClick={addCustomPreference} size="sm">
                  <Plus size={16} />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pickup Instructions */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Pickup Instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="instructions">Instructions for Customers</Label>
              <Textarea
                id="instructions"
                value={settings.pickupInstructions}
                onChange={(e) => handleInputChange("pickupInstructions", e.target.value)}
                placeholder="Enter pickup instructions..."
                className="min-h-[100px]"
              />
              <p className="text-sm text-muted-foreground mt-1">
                These instructions will be shown to customers when their order is ready
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Auto No-Show Settings */}
        <Card className="shadow-card lg:col-span-2">
          <CardHeader>
            <CardTitle>Auto No-Show Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="waitlistNoShow">Waitlist No-Show (minutes)</Label>
                <Input
                  id="waitlistNoShow"
                  type="number"
                  value={settings.autoNoShowTime}
                  onChange={(e) => handleInputChange("autoNoShowTime", e.target.value)}
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Automatically mark as no-show after table is ready
                </p>
              </div>
              <div>
                <Label>Food Orders No-Show</Label>
                <div className="p-3 bg-muted rounded-md text-sm text-muted-foreground">
                  Food orders are automatically marked as no-show at end of day if not collected
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} className="px-8">
          Save Settings
        </Button>
      </div>
    </div>
  );
};