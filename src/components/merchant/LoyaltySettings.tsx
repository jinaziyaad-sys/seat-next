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
import { Gift, Plus, Trash2, Save, Loader2, Stamp, Star, AlertTriangle } from "lucide-react";
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

  useEffect(() => {
    fetchProgram();
  }, [venueId]);

  const fetchProgram = async () => {
    setLoading(true);
    try {
      // Fetch venue service types
      const { data: venueData } = await supabase
        .from("venues")
        .select("service_types")
        .eq("id", venueId)
        .single();
      if (venueData?.service_types) setVenueServiceTypes(venueData.service_types);

      const { data: program } = await supabase
        .from("loyalty_programs")
        .select("*")
        .eq("venue_id", venueId)
        .maybeSingle();

      if (program) {
        setProgramId(program.id);
        setIsActive(program.is_active);
        setProgramType(program.type as "stamp_card" | "points");
        setStampThreshold(String(program.stamp_threshold || 10));
        setPointsPerVisit(String(program.points_per_visit || 10));
        setPointsPerOrder(String(program.points_per_order || 10));
        setEarningSources((program as any).earning_sources || ["order", "waitlist"]);
        setAdminEnabled((program as any).admin_enabled !== false);

        const { data: rewardsData } = await supabase
          .from("loyalty_rewards")
          .select("*")
          .eq("program_id", program.id)
          .order("created_at");

        if (rewardsData) setRewards(rewardsData);

        // Fetch stats
        const [members, codes] = await Promise.all([
          supabase.from("patron_loyalty").select("*", { count: "exact", head: true }).eq("venue_id", venueId),
          supabase.from("discount_codes").select("*", { count: "exact", head: true }).eq("venue_id", venueId),
        ]);
        const { data: redeemedCodes } = await supabase
          .from("discount_codes")
          .select("*", { count: "exact", head: true })
          .eq("venue_id", venueId)
          .eq("status", "redeemed");
        const { data: activeCodes } = await supabase
          .from("discount_codes")
          .select("*", { count: "exact", head: true })
          .eq("venue_id", venueId)
          .eq("status", "active");

        setStats({
          totalMembers: members.count || 0,
          totalRedemptions: redeemedCodes?.length || 0,
          activeDiscounts: activeCodes?.length || 0,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let currentProgramId = programId;

      if (programId) {
        const { error } = await supabase
          .from("loyalty_programs")
          .update({
            type: programType,
            stamp_threshold: parseInt(stampThreshold),
            points_per_visit: parseInt(pointsPerVisit),
            points_per_order: parseInt(pointsPerOrder),
            is_active: isActive,
            earning_sources: earningSources,
          } as any)
          .eq("id", programId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("loyalty_programs")
          .insert({
            venue_id: venueId,
            type: programType,
            stamp_threshold: parseInt(stampThreshold),
            points_per_visit: parseInt(pointsPerVisit),
            points_per_order: parseInt(pointsPerOrder),
            is_active: isActive,
            earning_sources: earningSources,
          } as any)
          .select()
          .single();
        if (error) throw error;
        currentProgramId = data.id;
        setProgramId(data.id);
      }

      // Save rewards
      for (const reward of rewards) {
        if (reward.id) {
          await supabase.from("loyalty_rewards").update({
            name: reward.name,
            description: reward.description,
            stamps_required: reward.stamps_required,
            points_required: reward.points_required,
            reward_type: reward.reward_type,
            is_active: reward.is_active,
          }).eq("id", reward.id);
        } else {
          const { data } = await supabase.from("loyalty_rewards").insert({
            venue_id: venueId,
            program_id: currentProgramId!,
            name: reward.name,
            description: reward.description,
            stamps_required: reward.stamps_required,
            points_required: reward.points_required,
            reward_type: reward.reward_type,
            is_active: reward.is_active,
          }).select().single();
          if (data) reward.id = data.id;
        }
      }

      toast({ title: "Loyalty program saved successfully" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const addReward = () => {
    setRewards([...rewards, {
      name: "",
      description: "",
      stamps_required: programType === "stamp_card" ? parseInt(stampThreshold) : null,
      points_required: programType === "points" ? 50 : null,
      reward_type: "discount_code",
      is_active: true,
    }]);
  };

  const updateReward = (index: number, field: keyof LoyaltyReward, value: any) => {
    setRewards(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r));
  };

  const removeReward = async (index: number) => {
    const reward = rewards[index];
    if (reward.id) {
      await supabase.from("loyalty_rewards").delete().eq("id", reward.id);
    }
    setRewards(prev => prev.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading loyalty settings...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Gift className="h-5 w-5 text-primary" />
              <CardTitle>Loyalty Program</CardTitle>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Stats */}
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

          {/* Program Type */}
          <div className="space-y-3">
            <Label>Program Type</Label>
            <Select value={programType} onValueChange={(v) => setProgramType(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stamp_card">
                  <div className="flex items-center gap-2">
                    <Stamp className="h-4 w-4" />
                    Stamp Card
                  </div>
                </SelectItem>
                <SelectItem value="points">
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4" />
                    Points System
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Program Settings */}
          {programType === "stamp_card" ? (
            <div className="space-y-2">
              <Label htmlFor="stampThreshold">Stamps needed for reward</Label>
              <Input
                id="stampThreshold"
                type="number"
                min="1"
                max="50"
                value={stampThreshold}
                onChange={(e) => setStampThreshold(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Patrons earn 1 stamp per visit/order. After {stampThreshold} stamps, they unlock a reward.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pointsPerVisit">Points per visit</Label>
                <Input
                  id="pointsPerVisit"
                  type="number"
                  min="1"
                  value={pointsPerVisit}
                  onChange={(e) => setPointsPerVisit(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pointsPerOrder">Points per order</Label>
                <Input
                  id="pointsPerOrder"
                  type="number"
                  min="1"
                  value={pointsPerOrder}
                  onChange={(e) => setPointsPerOrder(e.target.value)}
                />
              </div>
            </div>
          )}

          <Separator />

          {/* Rewards */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Rewards</Label>
              <Button variant="outline" size="sm" onClick={addReward}>
                <Plus className="h-4 w-4 mr-1" />
                Add Reward
              </Button>
            </div>

            {rewards.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No rewards configured. Add a reward to get started.
              </p>
            )}

            {rewards.map((reward, index) => (
              <Card key={index} className="border-dashed">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-3">
                      <Input
                        placeholder="Reward name (e.g., Free Dessert)"
                        value={reward.name}
                        onChange={(e) => updateReward(index, "name", e.target.value)}
                      />
                      <Input
                        placeholder="Description (e.g., Any dessert on the house)"
                        value={reward.description}
                        onChange={(e) => updateReward(index, "description", e.target.value)}
                      />
                      <div className="flex gap-3">
                        {programType === "stamp_card" ? (
                          <div className="space-y-1">
                            <Label className="text-xs">Stamps required</Label>
                            <Input
                              type="number"
                              min="1"
                              value={reward.stamps_required || ""}
                              onChange={(e) => updateReward(index, "stamps_required", parseInt(e.target.value) || null)}
                              className="w-24"
                            />
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <Label className="text-xs">Points required</Label>
                            <Input
                              type="number"
                              min="1"
                              value={reward.points_required || ""}
                              onChange={(e) => updateReward(index, "points_required", parseInt(e.target.value) || null)}
                              className="w-24"
                            />
                          </div>
                        )}
                        <div className="space-y-1">
                          <Label className="text-xs">Active</Label>
                          <div className="pt-1">
                            <Switch
                              checked={reward.is_active}
                              onCheckedChange={(v) => updateReward(index, "is_active", v)}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeReward(index)} className="text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
    </div>
  );
};
