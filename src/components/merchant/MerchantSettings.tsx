import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

export const MerchantSettings = ({ venue, venueId }: { venue: string; venueId: string }) => {
  const [settings, setSettings] = useState({
    venueCapacity: "40",
    tablesPerInterval: "4",
    defaultPrepTime: "10",
    maxExtensionTime: "45",
    enableIndoor: true,
    enableOutdoor: true,
    enableSmoking: false,
    pickupInstructions: "Please collect your order from the main counter. Show your order number to staff.",
    autoNoShowTime: "15"
  });

  const { toast } = useToast();

  const handleSave = () => {
    toast({
      title: "Settings Saved",
      description: "Venue settings have been updated successfully.",
    });
  };

  const handleInputChange = (key: string, value: string | boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
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

        {/* Seating Preferences */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Seating Preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="indoor">Indoor Seating</Label>
                <p className="text-sm text-muted-foreground">
                  Allow customers to request indoor seating
                </p>
              </div>
              <Switch
                id="indoor"
                checked={settings.enableIndoor}
                onCheckedChange={(checked) => handleInputChange("enableIndoor", checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="outdoor">Outdoor Seating</Label>
                <p className="text-sm text-muted-foreground">
                  Allow customers to request outdoor seating
                </p>
              </div>
              <Switch
                id="outdoor"
                checked={settings.enableOutdoor}
                onCheckedChange={(checked) => handleInputChange("enableOutdoor", checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="smoking">Smoking Section</Label>
                <p className="text-sm text-muted-foreground">
                  Allow customers to request smoking section
                </p>
              </div>
              <Switch
                id="smoking"
                checked={settings.enableSmoking}
                onCheckedChange={(checked) => handleInputChange("enableSmoking", checked)}
              />
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