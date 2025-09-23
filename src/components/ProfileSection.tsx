import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, User, Bell, Accessibility, Shield } from "lucide-react";

interface UserProfile {
  name: string;
  email: string;
  phone: string;
  marketingConsent: boolean;
  serviceConsent: boolean;
  largeText: boolean;
  vibrationEnabled: boolean;
  torchFlash: boolean;
}

export function ProfileSection({ onBack }: { onBack: () => void }) {
  const [profile, setProfile] = useState<UserProfile>({
    name: "",
    email: "",
    phone: "",
    marketingConsent: false,
    serviceConsent: true,
    largeText: false,
    vibrationEnabled: true,
    torchFlash: false,
  });

  const [isEditing, setIsEditing] = useState(false);

  const updateProfile = (field: keyof UserProfile, value: string | boolean) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    setIsEditing(false);
    // Here you would typically save to your backend
  };

  return (
    <div className="space-y-6 p-6 pb-24">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft size={20} />
        </Button>
        <h1 className="text-2xl font-bold">Profile</h1>
      </div>

      {/* Personal Information */}
      <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <User size={24} />
              <CardTitle>Personal Information</CardTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(!isEditing)}
            >
              {isEditing ? "Cancel" : "Edit"}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">Optional - helps personalize your experience</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="Your name"
              value={profile.name}
              onChange={(e) => updateProfile("name", e.target.value)}
              disabled={!isEditing}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="your.email@example.com"
              value={profile.email}
              onChange={(e) => updateProfile("email", e.target.value)}
              disabled={!isEditing}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+1 (555) 123-4567"
              value={profile.phone}
              onChange={(e) => updateProfile("phone", e.target.value)}
              disabled={!isEditing}
            />
          </div>

          {isEditing && (
            <Button onClick={handleSave} className="w-full">
              Save Changes
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Privacy & Consent */}
      <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Shield size={24} />
            <CardTitle>Privacy & Consent</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Service Communications</Label>
              <p className="text-sm text-muted-foreground">
                Order updates, table notifications, and service-related messages
              </p>
            </div>
            <Switch
              checked={profile.serviceConsent}
              onCheckedChange={(checked) => updateProfile("serviceConsent", checked)}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Marketing Communications</Label>
              <p className="text-sm text-muted-foreground">
                Promotions, special offers, and restaurant news
              </p>
            </div>
            <Switch
              checked={profile.marketingConsent}
              onCheckedChange={(checked) => updateProfile("marketingConsent", checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Accessibility Settings */}
      <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Accessibility size={24} />
            <CardTitle>Accessibility Settings</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Large Text</Label>
              <p className="text-sm text-muted-foreground">
                Increase text size throughout the app for better readability
              </p>
            </div>
            <Switch
              checked={profile.largeText}
              onCheckedChange={(checked) => updateProfile("largeText", checked)}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Vibration Alerts</Label>
              <p className="text-sm text-muted-foreground">
                Vibrate device when your order or table is ready
              </p>
            </div>
            <Switch
              checked={profile.vibrationEnabled}
              onCheckedChange={(checked) => updateProfile("vibrationEnabled", checked)}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Torch Flash Alerts</Label>
              <p className="text-sm text-muted-foreground">
                Flash the camera light when ready (if vibration is off)
              </p>
            </div>
            <Switch
              checked={profile.torchFlash}
              onCheckedChange={(checked) => updateProfile("torchFlash", checked)}
              disabled={profile.vibrationEnabled}
            />
          </div>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Bell size={24} />
            <CardTitle>Notification Preferences</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-primary"></div>
              <span>Order status updates</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-primary"></div>
              <span>Table ready notifications</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-primary"></div>
              <span>Queue position updates</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-coral"></div>
              <span>ETA extensions and delays</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}