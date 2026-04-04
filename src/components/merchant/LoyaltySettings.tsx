import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Gift, Plus, Trash2, Save, Loader2, Stamp, Star, AlertTriangle, Crown, Percent, Users, Target, Upload, Image } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface LoyaltyReward {
  id?: string;
  name: string;
  description: string;
  stamps_required: number | null;
  points_required: number | null;
  reward_type: string;
  is_active: boolean;
  image_url: string | null;
  voucher_validity_days: number | null;
}

interface TierData {
  id?: string;
  tier_name: string;
  min_lifetime_stamps: number;
  min_lifetime_points: number;
  perks: string[];
  color: string;
  sort_order: number;
  is_active: boolean;
}

interface ChallengeData {
  id?: string;
  title: string;
  description: string;
  goal_type: string;
  goal_value: number;
  reward_name: string;
  reward_description: string;
  reward_stamps: number;
  reward_points: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

interface LoyaltySettingsProps {
  venueId: string;
}

export const LoyaltySettings = ({ venueId }: LoyaltySettingsProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [programId, setProgramId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [programType, setProgramType] = useState<"stamp_card" | "points">("stamp_card");
  const [stampThreshold, setStampThreshold] = useState("10");
  const [pointsPerVisit, setPointsPerVisit] = useState("10");
  const [pointsPerOrder, setPointsPerOrder] = useState("10");
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [earningSources, setEarningSources] = useState<string[]>(["order", "waitlist"]);
  const [adminEnabled, setAdminEnabled] = useState(true);
  const [venueServiceTypes, setVenueServiceTypes] = useState<string[]>([]);
  const [stats, setStats] = useState({ totalMembers: 0, totalRedemptions: 0, activeDiscounts: 0 });

  // VIP Tiers
  const [tiers, setTiers] = useState<TierData[]>([]);
  const [tiersSaving, setTiersSaving] = useState(false);

  // Cashback
  const [cashbackActive, setCashbackActive] = useState(false);
  const [cashbackFixedAmount, setCashbackFixedAmount] = useState("5");
  const [cashbackSaving, setCashbackSaving] = useState(false);

  // Referral
  const [referralActive, setReferralActive] = useState(false);
  const [referrerRewardType, setReferrerRewardType] = useState("stamps");
  const [referrerRewardValue, setReferrerRewardValue] = useState("2");
  const [refereeRewardType, setRefereeRewardType] = useState("stamps");
  const [refereeRewardValue, setRefereeRewardValue] = useState("1");
  const [referralSaving, setReferralSaving] = useState(false);

  // Challenges
  const [challenges, setChallenges] = useState<ChallengeData[]>([]);
  const [challengesSaving, setChallengesSaving] = useState(false);

  useEffect(() => {
    fetchAll();
  }, [venueId]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchProgram(), fetchTiers(), fetchCashback(), fetchReferral(), fetchChallenges()]);
    } finally {
      setLoading(false);
    }
  };

  const fetchProgram = async () => {
    const { data: venueData } = await supabase.from("venues").select("service_types").eq("id", venueId).single();
    if (venueData?.service_types) setVenueServiceTypes(venueData.service_types);

    const { data: program } = await supabase.from("loyalty_programs").select("*").eq("venue_id", venueId).maybeSingle();

    if (program) {
      setProgramId(program.id);
      setIsActive(program.is_active);
      setProgramType(program.type as "stamp_card" | "points");
      setStampThreshold(String(program.stamp_threshold || 10));
      setPointsPerVisit(String(program.points_per_visit || 10));
      setPointsPerOrder(String(program.points_per_order || 10));
      setEarningSources((program as any).earning_sources || ["order", "waitlist"]);
      setAdminEnabled((program as any).admin_enabled !== false);

      const { data: rewardsData } = await supabase.from("loyalty_rewards").select("*").eq("program_id", program.id).order("created_at");
      if (rewardsData) setRewards(rewardsData);

      const [members, codes] = await Promise.all([
        supabase.from("patron_loyalty").select("*", { count: "exact", head: true }).eq("venue_id", venueId),
        supabase.from("discount_codes").select("*", { count: "exact", head: true }).eq("venue_id", venueId),
      ]);
      const { data: redeemedCodes } = await supabase.from("discount_codes").select("*", { count: "exact", head: true }).eq("venue_id", venueId).eq("status", "redeemed");
      const { data: activeCodes } = await supabase.from("discount_codes").select("*", { count: "exact", head: true }).eq("venue_id", venueId).eq("status", "active");
      setStats({ totalMembers: members.count || 0, totalRedemptions: redeemedCodes?.length || 0, activeDiscounts: activeCodes?.length || 0 });
    }
  };

  const fetchTiers = async () => {
    const { data } = await supabase.from("loyalty_tiers").select("*").eq("venue_id", venueId).order("sort_order");
    if (data) setTiers(data.map(t => ({ ...t, perks: Array.isArray(t.perks) ? t.perks as string[] : [] })));
  };

  const fetchCashback = async () => {
    const { data } = await supabase.from("venue_cashback_config").select("*").eq("venue_id", venueId).maybeSingle();
    if (data) {
      setCashbackActive(data.is_active);
      setCashbackFixedAmount(String((data as any).fixed_amount || 5));
    }
  };

  const fetchReferral = async () => {
    const { data } = await supabase.from("venue_referral_config").select("*").eq("venue_id", venueId).maybeSingle();
    if (data) {
      setReferralActive(data.is_active);
      setReferrerRewardType(data.referrer_reward_type);
      setReferrerRewardValue(String(data.referrer_reward_value));
      setRefereeRewardType(data.referee_reward_type);
      setRefereeRewardValue(String(data.referee_reward_value));
    }
  };

  const fetchChallenges = async () => {
    const { data } = await supabase.from("loyalty_challenges").select("*").eq("venue_id", venueId).order("created_at", { ascending: false });
    if (data) setChallenges(data.map(c => ({
      ...c,
      description: c.description || "",
      reward_description: c.reward_description || "",
      start_date: c.start_date ? new Date(c.start_date).toISOString().slice(0, 16) : "",
      end_date: c.end_date ? new Date(c.end_date).toISOString().slice(0, 16) : "",
    })));
  };

  // === STAMPS/POINTS SAVE ===
  const handleSave = async () => {
    setSaving(true);
    try {
      let currentProgramId = programId;
      if (programId) {
        const { error } = await supabase.from("loyalty_programs").update({
          type: programType, stamp_threshold: parseInt(stampThreshold),
          points_per_visit: parseInt(pointsPerVisit), points_per_order: parseInt(pointsPerOrder),
          is_active: isActive, earning_sources: earningSources,
        } as any).eq("id", programId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("loyalty_programs").insert({
          venue_id: venueId, type: programType, stamp_threshold: parseInt(stampThreshold),
          points_per_visit: parseInt(pointsPerVisit), points_per_order: parseInt(pointsPerOrder),
          is_active: isActive, earning_sources: earningSources,
        } as any).select().single();
        if (error) throw error;
        currentProgramId = data.id;
        setProgramId(data.id);
      }
      for (const reward of rewards) {
        if (reward.id) {
          await supabase.from("loyalty_rewards").update({
            name: reward.name, description: reward.description,
            stamps_required: reward.stamps_required, points_required: reward.points_required,
            reward_type: reward.reward_type, is_active: reward.is_active,
            image_url: reward.image_url, voucher_validity_days: reward.voucher_validity_days,
          } as any).eq("id", reward.id);
        } else {
          const { data } = await supabase.from("loyalty_rewards").insert({
            venue_id: venueId, program_id: currentProgramId!,
            name: reward.name, description: reward.description,
            stamps_required: reward.stamps_required, points_required: reward.points_required,
            reward_type: reward.reward_type, is_active: reward.is_active,
            image_url: reward.image_url, voucher_validity_days: reward.voucher_validity_days,
          } as any).select().single();
          if (data) reward.id = data.id;
        }
      }
      toast({ title: "Loyalty program saved successfully" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  // === TIERS SAVE ===
  const handleSaveTiers = async () => {
    setTiersSaving(true);
    try {
      for (const tier of tiers) {
        const payload = {
          venue_id: venueId, tier_name: tier.tier_name,
          min_lifetime_stamps: tier.min_lifetime_stamps, min_lifetime_points: tier.min_lifetime_points,
          perks: tier.perks as any, color: tier.color, sort_order: tier.sort_order, is_active: tier.is_active,
        };
        if (tier.id) {
          await supabase.from("loyalty_tiers").update(payload).eq("id", tier.id);
        } else {
          const { data } = await supabase.from("loyalty_tiers").insert(payload).select().single();
          if (data) tier.id = data.id;
        }
      }
      toast({ title: "VIP tiers saved successfully" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally { setTiersSaving(false); }
  };

  // === CASHBACK SAVE ===
  const handleSaveCashback = async () => {
    setCashbackSaving(true);
    try {
      const payload = {
        venue_id: venueId, is_active: cashbackActive, fixed_amount: parseFloat(cashbackFixedAmount),
        percentage: 0, min_order_value: 0, max_credit_per_order: 0,
      } as any;
      const { data: existing } = await supabase.from("venue_cashback_config").select("id").eq("venue_id", venueId).maybeSingle();
      if (existing) {
        await supabase.from("venue_cashback_config").update(payload).eq("id", existing.id);
      } else {
        await supabase.from("venue_cashback_config").insert(payload);
      }
      toast({ title: "Cashback settings saved" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally { setCashbackSaving(false); }
  };

  // === REFERRAL SAVE ===
  const handleSaveReferral = async () => {
    setReferralSaving(true);
    try {
      const payload = {
        venue_id: venueId, is_active: referralActive,
        referrer_reward_type: referrerRewardType, referrer_reward_value: parseInt(referrerRewardValue),
        referee_reward_type: refereeRewardType, referee_reward_value: parseInt(refereeRewardValue),
      };
      const { data: existing } = await supabase.from("venue_referral_config").select("id").eq("venue_id", venueId).maybeSingle();
      if (existing) {
        await supabase.from("venue_referral_config").update(payload).eq("id", existing.id);
      } else {
        await supabase.from("venue_referral_config").insert(payload);
      }
      toast({ title: "Referral settings saved" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally { setReferralSaving(false); }
  };

  // === CHALLENGES SAVE ===
  const handleSaveChallenges = async () => {
    setChallengesSaving(true);
    try {
      for (const ch of challenges) {
        const payload = {
          venue_id: venueId, title: ch.title, description: ch.description || null,
          goal_type: ch.goal_type, goal_value: ch.goal_value,
          reward_name: ch.reward_name, reward_description: ch.reward_description || null,
          reward_stamps: ch.reward_stamps, reward_points: ch.reward_points,
          start_date: ch.start_date ? new Date(ch.start_date).toISOString() : new Date().toISOString(),
          end_date: ch.end_date ? new Date(ch.end_date).toISOString() : null,
          is_active: ch.is_active,
        };
        if (ch.id) {
          await supabase.from("loyalty_challenges").update(payload).eq("id", ch.id);
        } else {
          const { data } = await supabase.from("loyalty_challenges").insert(payload).select().single();
          if (data) ch.id = data.id;
        }
      }
      toast({ title: "Challenges saved successfully" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally { setChallengesSaving(false); }
  };

  const addReward = () => {
    setRewards([...rewards, {
      name: "", description: "",
      stamps_required: programType === "stamp_card" ? parseInt(stampThreshold) : null,
      points_required: programType === "points" ? 50 : null,
      reward_type: "discount_code", is_active: true,
      image_url: null, voucher_validity_days: 30,
    }]);
  };

  const updateReward = (index: number, field: keyof LoyaltyReward, value: any) => {
    setRewards(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r));
  };

  const removeReward = async (index: number) => {
    const reward = rewards[index];
    if (reward.id) await supabase.from("loyalty_rewards").delete().eq("id", reward.id);
    setRewards(prev => prev.filter((_, i) => i !== index));
  };

  const addTier = () => {
    setTiers([...tiers, {
      tier_name: "", min_lifetime_stamps: 0, min_lifetime_points: 0,
      perks: [], color: "#FFD700", sort_order: tiers.length, is_active: true,
    }]);
  };

  const removeTier = async (index: number) => {
    const tier = tiers[index];
    if (tier.id) await supabase.from("loyalty_tiers").delete().eq("id", tier.id);
    setTiers(prev => prev.filter((_, i) => i !== index));
  };

  const addChallenge = () => {
    setChallenges([...challenges, {
      title: "", description: "", goal_type: "visit_count", goal_value: 3,
      reward_name: "", reward_description: "", reward_stamps: 0, reward_points: 0,
      start_date: new Date().toISOString().slice(0, 16), end_date: "", is_active: true,
    }]);
  };

  const removeChallenge = async (index: number) => {
    const ch = challenges[index];
    if (ch.id) await supabase.from("loyalty_challenges").delete().eq("id", ch.id);
    setChallenges(prev => prev.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <Card><CardContent className="p-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading loyalty settings...
        </div>
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-6">
      {!adminEnabled && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <p className="text-sm text-destructive font-medium">
            This loyalty program has been suspended by the platform administrator.
          </p>
        </div>
      )}

      <Tabs defaultValue="stamps" className="w-full">
        <TabsList className="w-full grid grid-cols-5">
          <TabsTrigger value="stamps" className="text-xs gap-1"><Stamp className="h-3 w-3" /> Stamps/Points</TabsTrigger>
          <TabsTrigger value="tiers" className="text-xs gap-1"><Crown className="h-3 w-3" /> VIP Tiers</TabsTrigger>
          <TabsTrigger value="cashback" className="text-xs gap-1"><Percent className="h-3 w-3" /> Cashback</TabsTrigger>
          <TabsTrigger value="referral" className="text-xs gap-1"><Users className="h-3 w-3" /> Referral</TabsTrigger>
          <TabsTrigger value="challenges" className="text-xs gap-1"><Target className="h-3 w-3" /> Challenges</TabsTrigger>
        </TabsList>

        {/* ===== STAMPS/POINTS TAB ===== */}
        <TabsContent value="stamps">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Gift className="h-5 w-5 text-primary" />
                  <CardTitle>Stamps & Points</CardTitle>
                </div>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {programId && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <p className="text-2xl font-bold">{stats.totalMembers}</p>
                    <p className="text-xs text-muted-foreground">Members</p>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <p className="text-2xl font-bold">{stats.totalRedemptions}</p>
                    <p className="text-xs text-muted-foreground">Redemptions</p>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <p className="text-2xl font-bold">{stats.activeDiscounts}</p>
                    <p className="text-xs text-muted-foreground">Active Codes</p>
                  </div>
                </div>
              )}
              <Separator />
              <div className="space-y-3">
                <Label>Program Type</Label>
                <Select value={programType} onValueChange={(v) => setProgramType(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stamp_card"><div className="flex items-center gap-2"><Stamp className="h-4 w-4" /> Stamp Card</div></SelectItem>
                    <SelectItem value="points"><div className="flex items-center gap-2"><Star className="h-4 w-4" /> Points System</div></SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {programType === "stamp_card" ? (
                <div className="space-y-2">
                  <Label>Stamps needed for reward</Label>
                  <Input type="number" min="1" max="50" value={stampThreshold} onChange={(e) => setStampThreshold(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Patrons earn 1 stamp per visit/order. After {stampThreshold} stamps, they unlock a reward.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Points per visit</Label>
                    <Input type="number" min="1" value={pointsPerVisit} onChange={(e) => setPointsPerVisit(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Points per order</Label>
                    <Input type="number" min="1" value={pointsPerOrder} onChange={(e) => setPointsPerOrder(e.target.value)} />
                  </div>
                </div>
              )}
              <Separator />
              <div className="space-y-3">
                <Label className="text-base font-semibold">Earning Sources</Label>
                <p className="text-xs text-muted-foreground">Choose how patrons earn loyalty credit</p>
                <div className="space-y-2">
                  {venueServiceTypes.includes("food_ready") && (
                    <div className="flex items-center gap-2">
                      <Checkbox id="earn-orders" checked={earningSources.includes("order")} onCheckedChange={(checked) => setEarningSources(prev => checked ? [...prev, "order"] : prev.filter(s => s !== "order"))} />
                      <label htmlFor="earn-orders" className="text-sm cursor-pointer">🍔 Earn from food orders (when collected)</label>
                    </div>
                  )}
                  {venueServiceTypes.includes("table_ready") && (
                    <div className="flex items-center gap-2">
                      <Checkbox id="earn-waitlist" checked={earningSources.includes("waitlist")} onCheckedChange={(checked) => setEarningSources(prev => checked ? [...prev, "waitlist"] : prev.filter(s => s !== "waitlist"))} />
                      <label htmlFor="earn-waitlist" className="text-sm cursor-pointer">🍽️ Earn from table visits (when seated)</label>
                    </div>
                  )}
                </div>
              </div>
              <Separator />
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Rewards</Label>
                  <Button variant="outline" size="sm" onClick={addReward}><Plus className="h-4 w-4 mr-1" /> Add Reward</Button>
                </div>
                {rewards.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No rewards configured. Add a reward to get started.</p>}
                {rewards.map((reward, index) => (
                  <Card key={index} className="border-dashed">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-3">
                          <Input placeholder="Reward name (e.g., Free Dessert)" value={reward.name} onChange={(e) => updateReward(index, "name", e.target.value)} />
                          <Input placeholder="Description" value={reward.description} onChange={(e) => updateReward(index, "description", e.target.value)} />
                          
                          {/* Reward Image Upload */}
                          <div className="space-y-2">
                            <Label className="text-xs">Reward Image</Label>
                            {reward.image_url ? (
                              <div className="relative inline-block">
                                <img src={reward.image_url} alt={reward.name} className="h-20 w-20 rounded-lg object-cover border" />
                                <Button
                                  variant="destructive"
                                  size="icon"
                                  className="absolute -top-2 -right-2 h-6 w-6"
                                  onClick={() => updateReward(index, "image_url", null)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : (
                              <label className="flex items-center gap-2 cursor-pointer p-3 border border-dashed rounded-lg hover:bg-muted/50 transition-colors">
                                <Upload className="h-4 w-4 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">Upload image</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    const ext = file.name.split('.').pop();
                                    const path = `${venueId}/${Date.now()}.${ext}`;
                                    const { error } = await supabase.storage.from('reward-images').upload(path, file);
                                    if (error) { toast({ title: "Upload failed", description: error.message, variant: "destructive" }); return; }
                                    const { data: urlData } = supabase.storage.from('reward-images').getPublicUrl(path);
                                    updateReward(index, "image_url", urlData.publicUrl);
                                  }}
                                />
                              </label>
                            )}
                          </div>

                          <div className="flex gap-3 flex-wrap">
                            {programType === "stamp_card" ? (
                              <div className="space-y-1">
                                <Label className="text-xs">Stamps required</Label>
                                <Input type="number" min="1" value={reward.stamps_required || ""} onChange={(e) => updateReward(index, "stamps_required", parseInt(e.target.value) || null)} className="w-24" />
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <Label className="text-xs">Points required</Label>
                                <Input type="number" min="1" value={reward.points_required || ""} onChange={(e) => updateReward(index, "points_required", parseInt(e.target.value) || null)} className="w-24" />
                              </div>
                            )}
                            <div className="space-y-1">
                              <Label className="text-xs">Voucher valid (days)</Label>
                              <Input type="number" min="1" max="365" value={reward.voucher_validity_days || 30} onChange={(e) => updateReward(index, "voucher_validity_days", parseInt(e.target.value) || 30)} className="w-24" />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Active</Label>
                              <div className="pt-1"><Switch checked={reward.is_active} onCheckedChange={(v) => updateReward(index, "is_active", v)} /></div>
                            </div>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => removeReward(index)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save Loyalty Program
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== VIP TIERS TAB ===== */}
        <TabsContent value="tiers">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Crown className="h-5 w-5 text-amber-500" />
                  <CardTitle>VIP Tiers</CardTitle>
                </div>
                <Button variant="outline" size="sm" onClick={addTier}><Plus className="h-4 w-4 mr-1" /> Add Tier</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Tiers are automatically assigned based on lifetime stamps or points. Higher tiers unlock better perks.
              </p>
              {tiers.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No tiers configured yet. Add a tier to get started.</p>}
              {tiers.map((tier, index) => (
                <Card key={index} className="border-dashed">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Tier Name</Label>
                            <Input placeholder="e.g., Gold" value={tier.tier_name} onChange={(e) => setTiers(prev => prev.map((t, i) => i === index ? { ...t, tier_name: e.target.value } : t))} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Color</Label>
                            <div className="flex gap-2">
                              <input type="color" value={tier.color} onChange={(e) => setTiers(prev => prev.map((t, i) => i === index ? { ...t, color: e.target.value } : t))} className="h-9 w-12 rounded border cursor-pointer" />
                              <Input value={tier.color} onChange={(e) => setTiers(prev => prev.map((t, i) => i === index ? { ...t, color: e.target.value } : t))} className="flex-1" />
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Min Lifetime Stamps</Label>
                            <Input type="number" min="0" value={tier.min_lifetime_stamps} onChange={(e) => setTiers(prev => prev.map((t, i) => i === index ? { ...t, min_lifetime_stamps: parseInt(e.target.value) || 0 } : t))} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Min Lifetime Points</Label>
                            <Input type="number" min="0" value={tier.min_lifetime_points} onChange={(e) => setTiers(prev => prev.map((t, i) => i === index ? { ...t, min_lifetime_points: parseInt(e.target.value) || 0 } : t))} />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Perks (comma-separated)</Label>
                          <Input placeholder="Priority seating, Free side, 10% discount" value={tier.perks.join(", ")} onChange={(e) => setTiers(prev => prev.map((t, i) => i === index ? { ...t, perks: e.target.value.split(",").map(s => s.trim()).filter(Boolean) } : t))} />
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Sort Order</Label>
                            <Input type="number" min="0" value={tier.sort_order} onChange={(e) => setTiers(prev => prev.map((t, i) => i === index ? { ...t, sort_order: parseInt(e.target.value) || 0 } : t))} className="w-20" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Active</Label>
                            <div className="pt-1"><Switch checked={tier.is_active} onCheckedChange={(v) => setTiers(prev => prev.map((t, i) => i === index ? { ...t, is_active: v } : t))} /></div>
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeTier(index)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              <Button onClick={handleSaveTiers} disabled={tiersSaving} className="w-full">
                {tiersSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save VIP Tiers
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== CASHBACK TAB ===== */}
        <TabsContent value="cashback">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Percent className="h-5 w-5 text-green-500" />
                  <CardTitle>Cashback / Credit</CardTitle>
                </div>
                <Switch checked={cashbackActive} onCheckedChange={setCashbackActive} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Patrons earn a fixed credit amount each time their order is collected. The credit is automatically added to their balance.
              </p>
              <div className="space-y-2">
                <Label>Credit per Order (R)</Label>
                <Input type="number" min="1" max="500" value={cashbackFixedAmount} onChange={(e) => setCashbackFixedAmount(e.target.value)} className="max-w-[200px]" />
                <p className="text-xs text-muted-foreground">Amount credited to the patron's balance each time an order is collected.</p>
              </div>
              <Button onClick={handleSaveCashback} disabled={cashbackSaving} className="w-full">
                {cashbackSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save Cashback Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== REFERRAL TAB ===== */}
        <TabsContent value="referral">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-blue-500" />
                  <CardTitle>Referral Program</CardTitle>
                </div>
                <Switch checked={referralActive} onCheckedChange={setReferralActive} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Patrons share a unique code. Both referrer and new patron earn rewards after the first visit/order.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3 p-3 bg-muted rounded-lg">
                  <p className="text-sm font-semibold">Referrer Reward</p>
                  <Select value={referrerRewardType} onValueChange={setReferrerRewardType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="stamps">Stamps</SelectItem>
                      <SelectItem value="points">Points</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input type="number" min="1" value={referrerRewardValue} onChange={(e) => setReferrerRewardValue(e.target.value)} />
                </div>
                <div className="space-y-3 p-3 bg-muted rounded-lg">
                  <p className="text-sm font-semibold">New Patron Reward</p>
                  <Select value={refereeRewardType} onValueChange={setRefereeRewardType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="stamps">Stamps</SelectItem>
                      <SelectItem value="points">Points</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input type="number" min="1" value={refereeRewardValue} onChange={(e) => setRefereeRewardValue(e.target.value)} />
                </div>
              </div>
              <Button onClick={handleSaveReferral} disabled={referralSaving} className="w-full">
                {referralSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save Referral Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== CHALLENGES TAB ===== */}
        <TabsContent value="challenges">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Target className="h-5 w-5 text-orange-500" />
                  <CardTitle>Challenges / Missions</CardTitle>
                </div>
                <Button variant="outline" size="sm" onClick={addChallenge}><Plus className="h-4 w-4 mr-1" /> Add Challenge</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Create time-limited goals for patrons. Complete challenges to earn bonus rewards.
              </p>
              {challenges.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No challenges yet. Create one to engage patrons!</p>}
              {challenges.map((ch, index) => (
                <Card key={index} className="border-dashed">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-3">
                        <Input placeholder="Challenge title (e.g., Weekend Warrior)" value={ch.title} onChange={(e) => setChallenges(prev => prev.map((c, i) => i === index ? { ...c, title: e.target.value } : c))} />
                        <Textarea placeholder="Description" value={ch.description} onChange={(e) => setChallenges(prev => prev.map((c, i) => i === index ? { ...c, description: e.target.value } : c))} rows={2} />
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Goal Type</Label>
                            <Select value={ch.goal_type} onValueChange={(v) => setChallenges(prev => prev.map((c, i) => i === index ? { ...c, goal_type: v } : c))}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="visit_count">Visit Count</SelectItem>
                                <SelectItem value="order_count">Order Count</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Goal Value</Label>
                            <Input type="number" min="1" value={ch.goal_value} onChange={(e) => setChallenges(prev => prev.map((c, i) => i === index ? { ...c, goal_value: parseInt(e.target.value) || 1 } : c))} />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Reward Name</Label>
                            <Input placeholder="e.g., Free Coffee" value={ch.reward_name} onChange={(e) => setChallenges(prev => prev.map((c, i) => i === index ? { ...c, reward_name: e.target.value } : c))} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Bonus Stamps/Points</Label>
                            <div className="flex gap-2">
                              <Input type="number" min="0" placeholder="Stamps" value={ch.reward_stamps} onChange={(e) => setChallenges(prev => prev.map((c, i) => i === index ? { ...c, reward_stamps: parseInt(e.target.value) || 0 } : c))} />
                              <Input type="number" min="0" placeholder="Points" value={ch.reward_points} onChange={(e) => setChallenges(prev => prev.map((c, i) => i === index ? { ...c, reward_points: parseInt(e.target.value) || 0 } : c))} />
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Start Date</Label>
                            <Input type="datetime-local" value={ch.start_date} onChange={(e) => setChallenges(prev => prev.map((c, i) => i === index ? { ...c, start_date: e.target.value } : c))} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">End Date (optional)</Label>
                            <Input type="datetime-local" value={ch.end_date} onChange={(e) => setChallenges(prev => prev.map((c, i) => i === index ? { ...c, end_date: e.target.value } : c))} />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch checked={ch.is_active} onCheckedChange={(v) => setChallenges(prev => prev.map((c, i) => i === index ? { ...c, is_active: v } : c))} />
                          <Label className="text-xs">Active</Label>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeChallenge(index)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              <Button onClick={handleSaveChallenges} disabled={challengesSaving} className="w-full">
                {challengesSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save Challenges
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
