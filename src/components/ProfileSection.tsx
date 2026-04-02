import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, User, Shield, LogOut, Palette, Sparkles, Loader2, Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { PasswordResetDialog } from "@/components/PasswordResetDialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PatronNotificationSettings } from "@/components/PatronNotificationSettings";
import { PatronDiningPreferences } from "@/components/PatronDiningPreferences";
import { YearlyRecap } from "@/components/YearlyRecap";
import { PatronLoyaltyCard } from "@/components/PatronLoyaltyCard";
import { DataPrivacySection } from "@/components/DataPrivacySection";
import { useYearlyRecap } from "@/hooks/useYearlyRecap";

interface UserProfile {
  full_name: string;
  email: string;
  phone: string;
}

export function ProfileSection({ onBack }: { onBack: () => void }) {
  const { t, i18n } = useTranslation();
  const [profile, setProfile] = useState<UserProfile>({
    full_name: "",
    email: "",
    phone: "",
  });
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  
  // Yearly Recap state
  const [showRecap, setShowRecap] = useState(false);
  const { 
    data: recapData, 
    loading: recapLoading, 
    fetchRecap, 
    markRecapSeen,
    clearRecapData 
  } = useYearlyRecap();

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUser(user);
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (data) {
        setProfile({
          full_name: data.full_name || '',
          email: data.email || user.email || '',
          phone: data.phone || '',
        });
      }
    }
    setLoading(false);
  };

  const updateProfile = (field: keyof UserProfile, value: string) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!user) return;

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: profile.full_name,
        phone: profile.phone,
      })
      .eq('id', user.id);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
      setIsEditing(false);
    }
  };

  const handleSignOut = async () => {
    onBack(); // Return to home view first
    await supabase.auth.signOut();
  };

  if (loading) {
    return <div className="p-6">{t("common.loading")}</div>;
  }

  if (!user) {
    return (
      <div className="p-6 pb-24 space-y-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-2xl font-bold">{t("profile.title")}</h1>
        </div>
        <Card className="shadow-card">
          <CardContent className="p-6 text-center">
            <p className="mb-4">{t("profile.signInRequired")}</p>
            <Button onClick={() => navigate("/auth")}>{t("profile.signInButton")}</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 pb-24" data-tour="profile-content">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-2xl font-bold">{t("profile.title")}</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={handleSignOut}>
          <LogOut size={20} />
        </Button>
      </div>

      {/* Personal Information */}
      <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <User size={24} />
              <CardTitle>{t("profile.personalInfo")}</CardTitle>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(!isEditing)}
              >
                {isEditing ? t("common.cancel") : t("profile.edit")}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t("profile.fullName")} *</Label>
            <Input
              id="name"
              placeholder={t("profile.namePlaceholder")}
              value={profile.full_name}
              onChange={(e) => updateProfile("full_name", e.target.value)}
              disabled={!isEditing}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="email">{t("profile.email")}</Label>
            <Input
              id="email"
              type="email"
              placeholder={t("profile.emailPlaceholder")}
              value={profile.email}
              disabled
            />
            <p className="text-xs text-muted-foreground">{t("profile.emailCannotChange")}</p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
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

      {/* Security Section */}
      <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Shield size={24} />
            <CardTitle>Security</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Password</p>
              <p className="text-sm text-muted-foreground">Reset your account password</p>
            </div>
            <PasswordResetDialog userEmail={profile.email} />
          </div>
        </CardContent>
      </Card>

      {/* Notifications Section */}
      <PatronNotificationSettings />

      {/* Loyalty Cards */}
      <PatronLoyaltyCard />

      {/* Data & Privacy Section (POPIA) */}
      <DataPrivacySection />

      {/* Dining Preferences Section */}
      <PatronDiningPreferences />

      {/* Yearly Recap Section (Test Mode) */}
      <Card className="shadow-card bg-gradient-to-br from-purple-900/20 to-background border-purple-500/20">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Sparkles size={24} className="text-amber-400" />
            <CardTitle>Your Year in Review</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Preview your {new Date().getFullYear()} recap</p>
              <p className="text-sm text-muted-foreground">See your activity highlights (test mode)</p>
            </div>
            <Button
              variant="outline"
              onClick={async () => {
                const result = await fetchRecap(new Date().getFullYear());
                if (result) {
                  setShowRecap(true);
                } else {
                  toast({
                    title: "Unable to load recap",
                    description: "Please try again later",
                    variant: "destructive",
                  });
                }
              }}
              disabled={recapLoading}
              className="gap-2"
            >
              {recapLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Preview Recap
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Language Section */}
      <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Globe size={24} />
            <CardTitle>{t("profile.language")}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{t("profile.language")}</p>
              <p className="text-sm text-muted-foreground">{t("profile.languageDesc")}</p>
            </div>
            <Select
              value={(() => {
                const lang = i18n.language || 'en';
                const supported = ['en','af','zu','xh','st','tn','nso','ve','ts','ss','nr','es','fr','pt','de','zh','ja','hi','ar','ko','ru','tr','it','nl','sw'];
                const match = supported.find(s => lang.startsWith(s));
                return match || 'en';
              })()}
              onValueChange={async (lang) => {
                i18n.changeLanguage(lang);
                localStorage.setItem('readyup-language', lang);
                if (user) {
                  await supabase.from('profiles').update({ preferred_language: lang } as any).eq('id', user.id);
                }
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="es">Español</SelectItem>
                <SelectItem value="fr">Français</SelectItem>
                <SelectItem value="pt">Português</SelectItem>
                <SelectItem value="de">Deutsch</SelectItem>
                <SelectItem value="it">Italiano</SelectItem>
                <SelectItem value="nl">Nederlands</SelectItem>
                <SelectItem value="ru">Русский</SelectItem>
                <SelectItem value="zh">中文</SelectItem>
                <SelectItem value="ja">日本語</SelectItem>
                <SelectItem value="ko">한국어</SelectItem>
                <SelectItem value="hi">हिन्दी</SelectItem>
                <SelectItem value="ar">العربية</SelectItem>
                <SelectItem value="tr">Türkçe</SelectItem>
                <SelectItem value="sw">Kiswahili</SelectItem>
                <SelectItem value="af">Afrikaans</SelectItem>
                <SelectItem value="zu">isiZulu</SelectItem>
                <SelectItem value="xh">isiXhosa</SelectItem>
                <SelectItem value="st">Sesotho</SelectItem>
                <SelectItem value="tn">Setswana</SelectItem>
                <SelectItem value="nso">Sepedi</SelectItem>
                <SelectItem value="ve">Tshivenḓa</SelectItem>
                <SelectItem value="ts">Xitsonga</SelectItem>
                <SelectItem value="ss">siSwati</SelectItem>
                <SelectItem value="nr">isiNdebele</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Appearance Section */}
      <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Palette size={24} />
            <CardTitle>{t("profile.appearance")}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{t("profile.theme")}</p>
              <p className="text-sm text-muted-foreground">{t("profile.themeDesc")}</p>
            </div>
            <ThemeToggle />
          </div>
        </CardContent>
      </Card>

      {/* Yearly Recap Overlay */}
      {showRecap && recapData && (
        <YearlyRecap
          data={recapData}
          onClose={() => {
            setShowRecap(false);
            clearRecapData();
          }}
          onComplete={() => {
            markRecapSeen(recapData.year);
            setShowRecap(false);
            clearRecapData();
            toast({
              title: "Thanks for viewing!",
              description: `Your ${recapData.year} recap is complete`,
            });
          }}
        />
      )}

    </div>
  );
}