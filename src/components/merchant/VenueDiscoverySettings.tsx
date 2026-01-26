import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Sparkles, Save, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface VenueAttributes {
  cuisine_types: string[];
  dietary_certifications: {
    halaal: boolean;
    vegetarian_friendly: boolean;
    vegan_options: boolean;
    kosher: boolean;
    gluten_free_options: boolean;
  };
  price_range: "budget" | "moderate" | "upscale";
  ambiance: string[];
  features: string[];
}

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
  { id: "fast_food", label: "Fast Food" },
  { id: "cafe", label: "Café" },
  { id: "seafood", label: "Seafood" },
  { id: "steakhouse", label: "Steakhouse" },
];

const FEATURE_OPTIONS = [
  { id: "outdoor_seating", label: "Outdoor Seating" },
  { id: "private_dining", label: "Private Dining" },
  { id: "live_entertainment", label: "Live Entertainment" },
  { id: "kid_friendly", label: "Kid-Friendly" },
  { id: "wheelchair_accessible", label: "Wheelchair Accessible" },
  { id: "parking", label: "Parking Available" },
  { id: "delivery", label: "Delivery" },
  { id: "takeaway", label: "Takeaway" },
];

const AMBIANCE_OPTIONS = [
  { id: "casual", label: "Casual" },
  { id: "family_friendly", label: "Family Friendly" },
  { id: "romantic", label: "Romantic" },
  { id: "business", label: "Business" },
  { id: "trendy", label: "Trendy" },
  { id: "traditional", label: "Traditional" },
];

interface VenueDiscoverySettingsProps {
  venueId: string;
  onAttributesChange?: (attributes: VenueAttributes) => void;
}

export function VenueDiscoverySettings({ venueId, onAttributesChange }: VenueDiscoverySettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const { toast } = useToast();

  const [attributes, setAttributes] = useState<VenueAttributes>({
    cuisine_types: [],
    dietary_certifications: {
      halaal: false,
      vegetarian_friendly: false,
      vegan_options: false,
      kosher: false,
      gluten_free_options: false,
    },
    price_range: "moderate",
    ambiance: [],
    features: [],
  });

  useEffect(() => {
    fetchVenueAttributes();
  }, [venueId]);

  const fetchVenueAttributes = async () => {
    const { data, error } = await supabase
      .from("venues")
      .select("settings")
      .eq("id", venueId)
      .single();

    if (error) {
      console.error("Error fetching venue settings:", error);
      setLoading(false);
      return;
    }

    const settings = data?.settings as Record<string, any> | null;
    if (settings?.venue_attributes) {
      setAttributes({
        cuisine_types: settings.venue_attributes.cuisine_types || [],
        dietary_certifications: {
          halaal: settings.venue_attributes.dietary_certifications?.halaal || false,
          vegetarian_friendly: settings.venue_attributes.dietary_certifications?.vegetarian_friendly || false,
          vegan_options: settings.venue_attributes.dietary_certifications?.vegan_options || false,
          kosher: settings.venue_attributes.dietary_certifications?.kosher || false,
          gluten_free_options: settings.venue_attributes.dietary_certifications?.gluten_free_options || false,
        },
        price_range: settings.venue_attributes.price_range || "moderate",
        ambiance: settings.venue_attributes.ambiance || [],
        features: settings.venue_attributes.features || [],
      });
    }
    setLoading(false);
  };

  const toggleCuisine = (id: string) => {
    setAttributes((prev) => ({
      ...prev,
      cuisine_types: prev.cuisine_types.includes(id)
        ? prev.cuisine_types.filter((c) => c !== id)
        : [...prev.cuisine_types, id],
    }));
    setHasChanges(true);
  };

  const toggleFeature = (id: string) => {
    setAttributes((prev) => ({
      ...prev,
      features: prev.features.includes(id)
        ? prev.features.filter((f) => f !== id)
        : [...prev.features, id],
    }));
    setHasChanges(true);
  };

  const toggleAmbiance = (id: string) => {
    setAttributes((prev) => ({
      ...prev,
      ambiance: prev.ambiance.includes(id)
        ? prev.ambiance.filter((a) => a !== id)
        : [...prev.ambiance, id],
    }));
    setHasChanges(true);
  };

  const toggleDietary = (key: keyof VenueAttributes["dietary_certifications"]) => {
    setAttributes((prev) => ({
      ...prev,
      dietary_certifications: {
        ...prev.dietary_certifications,
        [key]: !prev.dietary_certifications[key],
      },
    }));
    setHasChanges(true);
  };

  const setPriceRange = (value: "budget" | "moderate" | "upscale") => {
    setAttributes((prev) => ({ ...prev, price_range: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);

    // Get current settings
    const { data: currentVenue } = await supabase
      .from("venues")
      .select("settings")
      .eq("id", venueId)
      .single();

    const currentSettings = (currentVenue?.settings as Record<string, any>) || {};

    // Merge with new attributes
    const updatedSettings = {
      ...currentSettings,
      venue_attributes: attributes,
    };

    const { error } = await supabase
      .from("venues")
      .update({ settings: updatedSettings as any })
      .eq("id", venueId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to save venue attributes",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Saved",
        description: "Venue discovery profile updated",
      });
      setHasChanges(false);
      onAttributesChange?.(attributes);
    }

    setSaving(false);
  };

  if (loading) {
    return (
      <Card className="shadow-card">
        <CardContent className="p-6 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="shadow-card">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="text-lg">Venue Discovery Profile</CardTitle>
                  <p className="text-sm text-muted-foreground font-normal mt-1">
                    Help patrons find your venue based on their preferences
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {hasChanges && <Badge variant="outline" className="text-xs">Unsaved</Badge>}
                <ChevronDown className={cn("h-5 w-5 transition-transform", isOpen && "rotate-180")} />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-6 border-t pt-6">
            {/* Dietary Certifications */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Dietary Certifications</Label>
              <p className="text-sm text-muted-foreground">
                Enable options that apply to your venue's menu
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span>🕌</span>
                    <Label htmlFor="halaal" className="cursor-pointer">Halaal Certified</Label>
                  </div>
                  <Switch
                    id="halaal"
                    checked={attributes.dietary_certifications.halaal}
                    onCheckedChange={() => toggleDietary("halaal")}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span>🥬</span>
                    <Label htmlFor="vegetarian" className="cursor-pointer">Vegetarian Friendly</Label>
                  </div>
                  <Switch
                    id="vegetarian"
                    checked={attributes.dietary_certifications.vegetarian_friendly}
                    onCheckedChange={() => toggleDietary("vegetarian_friendly")}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span>🌱</span>
                    <Label htmlFor="vegan" className="cursor-pointer">Vegan Options</Label>
                  </div>
                  <Switch
                    id="vegan"
                    checked={attributes.dietary_certifications.vegan_options}
                    onCheckedChange={() => toggleDietary("vegan_options")}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span>✡️</span>
                    <Label htmlFor="kosher" className="cursor-pointer">Kosher</Label>
                  </div>
                  <Switch
                    id="kosher"
                    checked={attributes.dietary_certifications.kosher}
                    onCheckedChange={() => toggleDietary("kosher")}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span>🌾</span>
                    <Label htmlFor="gluten_free" className="cursor-pointer">Gluten-Free Options</Label>
                  </div>
                  <Switch
                    id="gluten_free"
                    checked={attributes.dietary_certifications.gluten_free_options}
                    onCheckedChange={() => toggleDietary("gluten_free_options")}
                  />
                </div>
              </div>
            </div>

            {/* Cuisine Types */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Cuisine Types</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {CUISINE_OPTIONS.map((cuisine) => (
                  <div key={cuisine.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`cuisine-${cuisine.id}`}
                      checked={attributes.cuisine_types.includes(cuisine.id)}
                      onCheckedChange={() => toggleCuisine(cuisine.id)}
                    />
                    <label
                      htmlFor={`cuisine-${cuisine.id}`}
                      className="text-sm cursor-pointer"
                    >
                      {cuisine.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Price Range */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Price Range</Label>
              <RadioGroup
                value={attributes.price_range}
                onValueChange={(v) => setPriceRange(v as "budget" | "moderate" | "upscale")}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="budget" id="budget" />
                  <Label htmlFor="budget" className="cursor-pointer">$ Budget</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="moderate" id="moderate" />
                  <Label htmlFor="moderate" className="cursor-pointer">$$ Moderate</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="upscale" id="upscale" />
                  <Label htmlFor="upscale" className="cursor-pointer">$$$ Upscale</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Ambiance */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Ambiance</Label>
              <div className="flex flex-wrap gap-2">
                {AMBIANCE_OPTIONS.map((option) => {
                  const isSelected = attributes.ambiance.includes(option.id);
                  return (
                    <button
                      key={option.id}
                      onClick={() => toggleAmbiance(option.id)}
                      className={cn(
                        "px-3 py-1.5 rounded-full border text-sm transition-all",
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Features */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Venue Features</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {FEATURE_OPTIONS.map((feature) => (
                  <div key={feature.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`feature-${feature.id}`}
                      checked={attributes.features.includes(feature.id)}
                      onCheckedChange={() => toggleFeature(feature.id)}
                    />
                    <label
                      htmlFor={`feature-${feature.id}`}
                      className="text-sm cursor-pointer"
                    >
                      {feature.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Save Button */}
            {hasChanges && (
              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Discovery Profile
                  </>
                )}
              </Button>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
