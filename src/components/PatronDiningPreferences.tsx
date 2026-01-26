import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Utensils, Leaf, Clock, Loader2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const DIETARY_OPTIONS = [
  { id: "halaal", label: "Halaal", icon: "🕌" },
  { id: "vegetarian", label: "Vegetarian", icon: "🥬" },
  { id: "vegan", label: "Vegan", icon: "🌱" },
  { id: "kosher", label: "Kosher", icon: "✡️" },
  { id: "gluten_free", label: "Gluten-Free", icon: "🌾" },
];

const CUISINE_OPTIONS = [
  { id: "italian", label: "Italian" },
  { id: "indian", label: "Indian" },
  { id: "asian", label: "Asian" },
  { id: "american", label: "American" },
  { id: "mediterranean", label: "Mediterranean" },
  { id: "african", label: "African" },
  { id: "mexican", label: "Mexican" },
  { id: "middle_eastern", label: "Middle Eastern" },
  { id: "french", label: "French" },
  { id: "japanese", label: "Japanese" },
  { id: "thai", label: "Thai" },
  { id: "chinese", label: "Chinese" },
];

interface DiningPreferences {
  id?: string;
  user_id: string;
  dietary_requirements: string[];
  cuisine_preferences: string[];
  avoid_ingredients: string[];
  max_wait_minutes: number;
}

export function PatronDiningPreferences() {
  const [preferences, setPreferences] = useState<DiningPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("patron_dining_preferences")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      console.error("Error fetching preferences:", error);
    }

    if (data) {
      setPreferences(data);
    } else {
      // Initialize with defaults
      setPreferences({
        user_id: user.id,
        dietary_requirements: [],
        cuisine_preferences: [],
        avoid_ingredients: [],
        max_wait_minutes: 30,
      });
    }
    setLoading(false);
  };

  const toggleDietary = (id: string) => {
    if (!preferences) return;
    const current = preferences.dietary_requirements || [];
    const updated = current.includes(id)
      ? current.filter((d) => d !== id)
      : [...current, id];
    setPreferences({ ...preferences, dietary_requirements: updated });
    setHasChanges(true);
  };

  const toggleCuisine = (id: string) => {
    if (!preferences) return;
    const current = preferences.cuisine_preferences || [];
    const updated = current.includes(id)
      ? current.filter((c) => c !== id)
      : [...current, id];
    setPreferences({ ...preferences, cuisine_preferences: updated });
    setHasChanges(true);
  };

  const handleWaitTimeChange = (value: number[]) => {
    if (!preferences) return;
    setPreferences({ ...preferences, max_wait_minutes: value[0] });
    setHasChanges(true);
  };

  const savePreferences = async () => {
    if (!preferences) return;
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to save preferences",
        variant: "destructive",
      });
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("patron_dining_preferences")
      .upsert({
        user_id: user.id,
        dietary_requirements: preferences.dietary_requirements,
        cuisine_preferences: preferences.cuisine_preferences,
        avoid_ingredients: preferences.avoid_ingredients,
        max_wait_minutes: preferences.max_wait_minutes,
      }, {
        onConflict: "user_id"
      });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to save preferences",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Saved",
        description: "Your dining preferences have been updated",
      });
      setHasChanges(false);
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <Card className="shadow-card">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-card">
      <CardHeader>
        <div className="flex items-center gap-3">
          <Utensils size={24} />
          <CardTitle>Dining Preferences</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">
          Set your preferences to get personalized venue recommendations
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Dietary Requirements */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Leaf className="h-4 w-4 text-success" />
            <Label className="text-base font-medium">Dietary Requirements</Label>
          </div>
          <div className="flex flex-wrap gap-2">
            {DIETARY_OPTIONS.map((option) => {
              const isSelected = preferences?.dietary_requirements?.includes(option.id);
              return (
                <button
                  key={option.id}
                  onClick={() => toggleDietary(option.id)}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-full border-2 transition-all
                    ${isSelected 
                      ? "border-primary bg-primary/10 text-primary" 
                      : "border-border hover:border-primary/50"
                    }
                  `}
                >
                  <span>{option.icon}</span>
                  <span className="text-sm font-medium">{option.label}</span>
                  {isSelected && <Check className="h-4 w-4" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Cuisine Preferences */}
        <div className="space-y-3">
          <Label className="text-base font-medium">Favorite Cuisines</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {CUISINE_OPTIONS.map((cuisine) => {
              const isSelected = preferences?.cuisine_preferences?.includes(cuisine.id);
              return (
                <div key={cuisine.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`cuisine-${cuisine.id}`}
                    checked={isSelected}
                    onCheckedChange={() => toggleCuisine(cuisine.id)}
                  />
                  <label
                    htmlFor={`cuisine-${cuisine.id}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    {cuisine.label}
                  </label>
                </div>
              );
            })}
          </div>
          {preferences?.cuisine_preferences && preferences.cuisine_preferences.length === 0 && (
            <p className="text-xs text-muted-foreground">No preference - show all cuisines</p>
          )}
        </div>

        {/* Wait Time Preference */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <Label className="text-base font-medium">Maximum Wait Time</Label>
          </div>
          <div className="space-y-3">
            <Slider
              value={[preferences?.max_wait_minutes || 30]}
              onValueChange={handleWaitTimeChange}
              max={60}
              min={5}
              step={5}
              className="w-full"
            />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>5 min</span>
              <Badge variant="outline" className="font-mono">
                {preferences?.max_wait_minutes || 30} min
              </Badge>
              <span>60 min</span>
            </div>
            <p className="text-xs text-muted-foreground">
              We'll prioritize venues with shorter wait times based on your preference
            </p>
          </div>
        </div>

        {/* Save Button */}
        {hasChanges && (
          <Button onClick={savePreferences} disabled={saving} className="w-full">
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Preferences"
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
