import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Loader2, UtensilsCrossed, Users, Calendar, Star, ChefHat, BarChart3 } from 'lucide-react';
import { FeatureFlags } from '@/hooks/usePlatformConfig';
import { cn } from '@/lib/utils';

interface FeatureFlagsPanelProps {
  features: FeatureFlags;
  loading: boolean;
  onToggle: (key: string, value: boolean) => Promise<void>;
  onRolloutChange?: (key: string, percentage: number) => Promise<void> | Promise<boolean>;
  rolloutPercentages?: Record<string, number>;
}

const FEATURE_CONFIG = [
  { key: 'feature.food_ordering_enabled', field: 'food_ordering_enabled' as keyof FeatureFlags, label: 'Food Ordering', description: 'Allow patrons to place food orders', icon: UtensilsCrossed },
  { key: 'feature.waitlist_enabled', field: 'waitlist_enabled' as keyof FeatureFlags, label: 'Waitlist', description: 'Allow patrons to join venue waitlists', icon: Users },
  { key: 'feature.reservations_enabled', field: 'reservations_enabled' as keyof FeatureFlags, label: 'Reservations', description: 'Allow patrons to make reservations', icon: Calendar },
  { key: 'feature.ratings_enabled', field: 'ratings_enabled' as keyof FeatureFlags, label: 'Ratings & Reviews', description: 'Allow patrons to rate their experience', icon: Star },
  { key: 'feature.kitchen_board_enabled', field: 'kitchen_board_enabled' as keyof FeatureFlags, label: 'Kitchen Board', description: 'Show kitchen board view for merchants', icon: ChefHat },
  { key: 'feature.analytics_enabled', field: 'analytics_enabled' as keyof FeatureFlags, label: 'Analytics Dashboard', description: 'Show analytics and reports for merchants', icon: BarChart3 },
];

export function FeatureFlagsPanel({ features, loading, onToggle, onRolloutChange, rolloutPercentages = {} }: FeatureFlagsPanelProps) {
  const [pendingToggles, setPendingToggles] = useState<Record<string, boolean>>({});

  const handleToggle = async (key: string, value: boolean) => {
    setPendingToggles(prev => ({ ...prev, [key]: true }));
    try {
      await onToggle(key, value);
    } finally {
      setPendingToggles(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleRollout = async (key: string, value: number[]) => {
    if (onRolloutChange) {
      await onRolloutChange(key, value[0]);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Feature Flags
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        </CardTitle>
        <CardDescription>
          Toggle features on/off and control rollout percentage. Changes take effect immediately.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {FEATURE_CONFIG.map((feature) => {
          const Icon = feature.icon;
          const isEnabled = features[feature.field];
          const isPending = pendingToggles[feature.key];
          const rollout = rolloutPercentages[feature.key] ?? 100;
          
          return (
            <div
              key={feature.key}
              className={cn(
                "rounded-lg border p-4 transition-opacity space-y-3",
                isPending && "opacity-70"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "rounded-full p-2 transition-colors",
                    isEnabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                  )}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <Label htmlFor={feature.key} className="text-sm font-medium cursor-pointer">
                      {feature.label}
                    </Label>
                    <p className="text-xs text-muted-foreground">{feature.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={isEnabled ? 'default' : 'secondary'} className="transition-colors">
                    {isEnabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                  <div className="relative">
                    <Switch
                      id={feature.key}
                      checked={isEnabled}
                      onCheckedChange={(checked) => handleToggle(feature.key, checked)}
                      disabled={isPending}
                    />
                    {isPending && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {isEnabled && onRolloutChange && (
                <div className="flex items-center gap-4 pl-11">
                  <span className="text-xs text-muted-foreground whitespace-nowrap w-16">Rollout:</span>
                  <Slider
                    value={[rollout]}
                    onValueCommit={(v) => handleRollout(feature.key, v)}
                    min={1}
                    max={100}
                    step={1}
                    className="flex-1"
                  />
                  <span className="text-xs font-medium w-10 text-right">{rollout}%</span>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
