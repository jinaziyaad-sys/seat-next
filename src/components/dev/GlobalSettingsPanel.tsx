import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, Clock, Users, Timer, Save } from 'lucide-react';
import { GlobalSettings } from '@/hooks/usePlatformConfig';

interface GlobalSettingsPanelProps {
  settings: GlobalSettings;
  loading: boolean;
  onUpdate: (key: string, value: number) => Promise<void>;
}

const SETTINGS_CONFIG = [
  {
    key: 'global.default_prep_time_minutes',
    field: 'default_prep_time_minutes' as keyof GlobalSettings,
    label: 'Default Prep Time',
    description: 'Default food preparation time for new orders',
    suffix: 'minutes',
    icon: Clock,
    min: 5,
    max: 120,
  },
  {
    key: 'global.default_wait_time_minutes',
    field: 'default_wait_time_minutes' as keyof GlobalSettings,
    label: 'Default Wait Time',
    description: 'Default waitlist wait time estimate',
    suffix: 'minutes',
    icon: Timer,
    min: 5,
    max: 180,
  },
  {
    key: 'global.max_party_size',
    field: 'max_party_size' as keyof GlobalSettings,
    label: 'Maximum Party Size',
    description: 'Maximum number of guests in a party',
    suffix: 'guests',
    icon: Users,
    min: 1,
    max: 100,
  },
  {
    key: 'global.ready_deadline_minutes',
    field: 'ready_deadline_minutes' as keyof GlobalSettings,
    label: 'Ready Deadline',
    description: 'Time before a ready order/table expires',
    suffix: 'minutes',
    icon: Timer,
    min: 5,
    max: 60,
  },
];

export function GlobalSettingsPanel({ settings, loading, onUpdate }: GlobalSettingsPanelProps) {
  const [editValues, setEditValues] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const handleSave = async (key: string, field: keyof GlobalSettings) => {
    const value = editValues[key] ?? settings[field];
    setSaving(key);
    await onUpdate(key, value);
    setSaving(null);
    // Clear the edit value after saving
    setEditValues((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Global Settings
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        </CardTitle>
        <CardDescription>
          Configure default values that apply across all venues.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {SETTINGS_CONFIG.map((setting) => {
          const Icon = setting.icon;
          const currentValue = settings[setting.field];
          const editValue = editValues[setting.key];
          const hasChanges = editValue !== undefined && editValue !== currentValue;
          
          return (
            <div
              key={setting.key}
              className="flex items-center justify-between rounded-lg border p-4"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-primary/10 p-2 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <Label htmlFor={setting.key} className="text-sm font-medium">
                    {setting.label}
                  </Label>
                  <p className="text-xs text-muted-foreground">{setting.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  id={setting.key}
                  type="number"
                  min={setting.min}
                  max={setting.max}
                  value={editValue ?? currentValue}
                  onChange={(e) => setEditValues((prev) => ({
                    ...prev,
                    [setting.key]: parseInt(e.target.value) || 0,
                  }))}
                  className="w-20 text-center"
                  disabled={loading || saving === setting.key}
                />
                <span className="text-xs text-muted-foreground">{setting.suffix}</span>
                <Button
                  size="sm"
                  variant={hasChanges ? 'default' : 'ghost'}
                  onClick={() => handleSave(setting.key, setting.field)}
                  disabled={!hasChanges || saving === setting.key}
                >
                  {saving === setting.key ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
