import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface PlatformConfig {
  id: string;
  key: string;
  value: any;
  description: string | null;
  category: string;
  updated_at: string;
  rollout_percentage?: number;
  user_segments?: any;
}

export interface FeatureFlags {
  food_ordering_enabled: boolean;
  waitlist_enabled: boolean;
  reservations_enabled: boolean;
  ratings_enabled: boolean;
  kitchen_board_enabled: boolean;
  analytics_enabled: boolean;
}

export type Announcement = {
  message: string;
  type: 'info' | 'warning' | 'error' | 'maintenance';
  dismissible: boolean;
  expires_at?: string;
} | null;

export interface UsePlatformConfigReturn {
  configs: PlatformConfig[];
  features: FeatureFlags;
  announcement: Announcement;
  loading: boolean;
  rolloutPercentages: Record<string, number>;
  updateConfig: (key: string, value: any) => Promise<boolean>;
  updateRollout: (key: string, percentage: number) => Promise<boolean>;
  refetch: () => Promise<void>;
}

const DEFAULT_FEATURES: FeatureFlags = {
  food_ordering_enabled: true,
  waitlist_enabled: true,
  reservations_enabled: true,
  ratings_enabled: true,
  kitchen_board_enabled: true,
  analytics_enabled: true,
};

// Simple hash function for user ID -> 0-99
function hashUserId(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash) % 100;
}

export function usePlatformConfig(): UsePlatformConfigReturn {
  const [configs, setConfigs] = useState<PlatformConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);

  const parseConfigs = useCallback((configList: PlatformConfig[]) => {
    const features = { ...DEFAULT_FEATURES };
    const rolloutPercentages: Record<string, number> = {};
    let announcement: Announcement = null;

    configList.forEach((config) => {
      const value = typeof config.value === 'string' 
        ? (config.value === 'true' ? true : config.value === 'false' ? false : config.value === 'null' ? null : config.value)
        : config.value;

      const rollout = config.rollout_percentage ?? 100;

      // Check if feature passes rollout gate
      const passesRollout = userId ? hashUserId(userId) < rollout : true;

      // Feature flags
      if (config.key === 'feature.food_ordering_enabled') { features.food_ordering_enabled = !!value && passesRollout; rolloutPercentages[config.key] = rollout; }
      if (config.key === 'feature.waitlist_enabled') { features.waitlist_enabled = !!value && passesRollout; rolloutPercentages[config.key] = rollout; }
      if (config.key === 'feature.reservations_enabled') { features.reservations_enabled = !!value && passesRollout; rolloutPercentages[config.key] = rollout; }
      if (config.key === 'feature.ratings_enabled') { features.ratings_enabled = !!value && passesRollout; rolloutPercentages[config.key] = rollout; }
      if (config.key === 'feature.kitchen_board_enabled') { features.kitchen_board_enabled = !!value && passesRollout; rolloutPercentages[config.key] = rollout; }
      if (config.key === 'feature.analytics_enabled') { features.analytics_enabled = !!value && passesRollout; rolloutPercentages[config.key] = rollout; }

      // Announcement
      if (config.key === 'announcement.active' && value && value !== 'null') {
        announcement = typeof value === 'object' ? value : null;
      }
    });

    return { features, announcement, rolloutPercentages };
  }, [userId]);

  const fetchConfigs = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('platform_config')
        .select('*')
        .order('key');

      if (error) {
        console.error('Error fetching platform config:', error);
        return;
      }

      setConfigs(data || []);
    } catch (error) {
      console.error('Error fetching platform config:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateConfig = useCallback(async (key: string, value: any): Promise<boolean> => {
    const previousConfigs = [...configs];
    const newValue = typeof value === 'boolean' ? String(value) : value;
    
    setConfigs(prev => prev.map(config => 
      config.key === key 
        ? { ...config, value: newValue, updated_at: new Date().toISOString() }
        : config
    ));

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('platform_config')
        .update({ 
          value: newValue,
          updated_by: user?.id,
          updated_at: new Date().toISOString()
        })
        .eq('key', key);

      if (error) {
        setConfigs(previousConfigs);
        toast({ variant: 'destructive', title: 'Update Failed', description: error.message });
        return false;
      }

      toast({ title: 'Configuration Updated', description: `${key} has been updated successfully.` });
      return true;
    } catch (error) {
      setConfigs(previousConfigs);
      console.error('Error updating config:', error);
      return false;
    }
  }, [toast, configs]);

  const updateRollout = useCallback(async (key: string, percentage: number): Promise<boolean> => {
    const previousConfigs = [...configs];
    
    setConfigs(prev => prev.map(config => 
      config.key === key 
        ? { ...config, rollout_percentage: percentage, updated_at: new Date().toISOString() }
        : config
    ));

    try {
      const { error } = await supabase
        .from('platform_config')
        .update({ rollout_percentage: percentage } as any)
        .eq('key', key);

      if (error) {
        setConfigs(previousConfigs);
        toast({ variant: 'destructive', title: 'Update Failed', description: error.message });
        return false;
      }

      toast({ title: 'Rollout Updated', description: `${key} rollout set to ${percentage}%` });
      return true;
    } catch (error) {
      setConfigs(previousConfigs);
      return false;
    }
  }, [toast, configs]);

  useEffect(() => {
    fetchConfigs();

    const channel = supabase
      .channel('platform-config-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'platform_config' },
        (payload) => {
          console.log('Platform config changed:', payload);
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            setConfigs((prev) => {
              const newConfig = payload.new as PlatformConfig;
              const existing = prev.findIndex((c) => c.id === newConfig.id);
              if (existing >= 0) {
                const updated = [...prev];
                updated[existing] = newConfig;
                return updated;
              }
              return [...prev, newConfig];
            });
          } else if (payload.eventType === 'DELETE') {
            setConfigs((prev) => prev.filter((c) => c.id !== (payload.old as any).id));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchConfigs]);

  const { features, announcement, rolloutPercentages } = parseConfigs(configs);

  return {
    configs,
    features,
    announcement,
    loading,
    rolloutPercentages,
    updateConfig,
    updateRollout,
    refetch: fetchConfigs,
  };
}
