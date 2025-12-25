import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, UtensilsCrossed, Users, Calendar, Star, ChefHat, BarChart3 } from 'lucide-react';
import { FeatureFlags } from '@/hooks/usePlatformConfig';

interface FeatureFlagsPanelProps {
  features: FeatureFlags;
  loading: boolean;
  onToggle: (key: string, value: boolean) => Promise<void>;
}

const FEATURE_CONFIG = [
  {
    key: 'feature.food_ordering_enabled',
    field: 'food_ordering_enabled' as keyof FeatureFlags,
    label: 'Food Ordering',
    description: 'Allow patrons to place food orders',
    icon: UtensilsCrossed,
  },
  {
    key: 'feature.waitlist_enabled',
    field: 'waitlist_enabled' as keyof FeatureFlags,
    label: 'Waitlist',
    description: 'Allow patrons to join venue waitlists',
    icon: Users,
  },
  {
    key: 'feature.reservations_enabled',
    field: 'reservations_enabled' as keyof FeatureFlags,
    label: 'Reservations',
    description: 'Allow patrons to make reservations',
    icon: Calendar,
  },
  {
    key: 'feature.ratings_enabled',
    field: 'ratings_enabled' as keyof FeatureFlags,
    label: 'Ratings & Reviews',
    description: 'Allow patrons to rate their experience',
    icon: Star,
  },
  {
    key: 'feature.kitchen_board_enabled',
    field: 'kitchen_board_enabled' as keyof FeatureFlags,
    label: 'Kitchen Board',
    description: 'Show kitchen board view for merchants',
    icon: ChefHat,
  },
  {
    key: 'feature.analytics_enabled',
    field: 'analytics_enabled' as keyof FeatureFlags,
    label: 'Analytics Dashboard',
    description: 'Show analytics and reports for merchants',
    icon: BarChart3,
  },
];

export function FeatureFlagsPanel({ features, loading, onToggle }: FeatureFlagsPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Feature Flags
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        </CardTitle>
        <CardDescription>
          Toggle features on/off across the entire platform. Changes take effect immediately.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {FEATURE_CONFIG.map((feature) => {
          const Icon = feature.icon;
          const isEnabled = features[feature.field];
          
          return (
            <div
              key={feature.key}
              className="flex items-center justify-between rounded-lg border p-4"
            >
              <div className="flex items-center gap-3">
                <div className={`rounded-full p-2 ${isEnabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
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
                <Badge variant={isEnabled ? 'default' : 'secondary'}>
                  {isEnabled ? 'Enabled' : 'Disabled'}
                </Badge>
                <Switch
                  id={feature.key}
                  checked={isEnabled}
                  onCheckedChange={(checked) => onToggle(feature.key, checked)}
                  disabled={loading}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
