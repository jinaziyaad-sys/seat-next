import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Bell, Plus, Trash2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface AlertRule {
  id: string;
  metric: string;
  threshold: number;
  comparison: string;
  notification_channel: string;
  is_active: boolean;
  cooldown_minutes: number;
  last_triggered_at: string | null;
  created_at: string;
}

const METRICS = [
  { value: 'error_count_1h', label: 'Errors in last hour' },
  { value: 'pending_orders', label: 'Pending orders' },
  { value: 'pending_data_requests', label: 'Pending data requests' },
  { value: 'waitlist_length', label: 'Active waitlist entries' },
  { value: 'active_venues', label: 'Active venues' },
];

const COMPARISONS = [
  { value: 'greater_than', label: '>' },
  { value: 'less_than', label: '<' },
  { value: 'equals', label: '=' },
];

export function AlertRulesPanel() {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newMetric, setNewMetric] = useState('error_count_1h');
  const [newThreshold, setNewThreshold] = useState(5);
  const [newComparison, setNewComparison] = useState('greater_than');
  const [newCooldown, setNewCooldown] = useState(60);
  const { toast } = useToast();

  useEffect(() => { fetchRules(); }, []);

  const fetchRules = async () => {
    const { data, error } = await supabase
      .from('alert_rules')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setRules(data as AlertRule[]);
    setLoading(false);
  };

  const createRule = async () => {
    const { error } = await supabase.from('alert_rules').insert({
      metric: newMetric,
      threshold: newThreshold,
      comparison: newComparison,
      cooldown_minutes: newCooldown,
      notification_channel: 'push',
      created_by: (await supabase.auth.getUser()).data.user?.id,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Alert rule created" });
      setShowCreate(false);
      fetchRules();
    }
  };

  const toggleRule = async (id: string, isActive: boolean) => {
    await supabase.from('alert_rules').update({ is_active: !isActive }).eq('id', id);
    fetchRules();
  };

  const deleteRule = async (id: string) => {
    await supabase.from('alert_rules').delete().eq('id', id);
    fetchRules();
  };

  const getMetricLabel = (metric: string) => METRICS.find(m => m.value === metric)?.label || metric;
  const getComparisonLabel = (comp: string) => COMPARISONS.find(c => c.value === comp)?.label || comp;

  if (loading) return <div className="text-center py-8 text-muted-foreground">Loading alert rules...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Automated Alerts
        </h3>
        <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
          <Plus className="h-4 w-4 mr-1" /> New Rule
        </Button>
      </div>

      {showCreate && (
        <Card>
          <CardContent className="pt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Metric</Label>
                <Select value={newMetric} onValueChange={setNewMetric}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {METRICS.map(m => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Comparison</Label>
                <Select value={newComparison} onValueChange={setNewComparison}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COMPARISONS.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label} threshold</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Threshold</Label>
                <Input type="number" value={newThreshold} onChange={e => setNewThreshold(Number(e.target.value))} />
              </div>
              <div>
                <Label>Cooldown (minutes)</Label>
                <Input type="number" value={newCooldown} onChange={e => setNewCooldown(Number(e.target.value))} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={createRule}>Create Rule</Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {rules.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">No alert rules configured yet.</p>
      ) : (
        <div className="space-y-3">
          {rules.map(rule => (
            <Card key={rule.id}>
              <CardContent className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={rule.is_active}
                    onCheckedChange={() => toggleRule(rule.id, rule.is_active)}
                    aria-label={`Toggle ${getMetricLabel(rule.metric)} alert`}
                  />
                  <div>
                    <p className="font-medium text-sm">
                      {getMetricLabel(rule.metric)} {getComparisonLabel(rule.comparison)} {rule.threshold}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>Cooldown: {rule.cooldown_minutes}min</span>
                      {rule.last_triggered_at && (
                        <Badge variant="outline" className="text-xs">
                          Last fired: {format(new Date(rule.last_triggered_at), 'MMM d, HH:mm')}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => deleteRule(rule.id)} aria-label="Delete alert rule">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
