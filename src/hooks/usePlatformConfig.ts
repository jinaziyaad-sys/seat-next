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
  updateConfig: (key: string, value: any) => Promise<boolean>;
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

export function usePlatformConfig(): UsePlatformConfigReturn {
  const [configs, setConfigs] = useState<PlatformConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const parseConfigs = useCallback((configList: PlatformConfig[]) => {
    const features = { ...DEFAULT_FEATURES };
    let announcement: Announcement = null;

    configList.forEach((config) => {
      const value = typeof config.value === 'string' 
        ? (config.value === 'true' ? true : config.value === 'false' ? false : config.value === 'null' ? null : config.value)
        : config.value;

      // Feature flags
      if (config.key === 'feature.food_ordering_enabled') features.food_ordering_enabled = !!value;
      if (config.key === 'feature.waitlist_enabled') features.waitlist_enabled = !!value;
      if (config.key === 'feature.reservations_enabled') features.reservations_enabled = !!value;
      if (config.key === 'feature.ratings_enabled') features.ratings_enabled = !!value;
      if (config.key === 'feature.kitchen_board_enabled') features.kitchen_board_enabled = !!value;
      if (config.key === 'feature.analytics_enabled') features.analytics_enabled = !!value;

      // Announcement
      if (config.key === 'announcement.active' && value && value !== 'null') {
        announcement = typeof value === 'object' ? value : null;
      }
    });

    return { features, announcement };
  }, []);

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
    // Optimistic update - immediately update local state
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
        // Rollback on failure
        setConfigs(previousConfigs);
        console.error('Error updating config:', error);
        toast({
          variant: 'destructive',
          title: 'Update Failed',
          description: error.message,
        });
        return false;
      }

      toast({
        title: 'Configuration Updated',
        description: `${key} has been updated successfully.`,
      });

      return true;
    } catch (error) {
      // Rollback on failure
      setConfigs(previousConfigs);
      console.error('Error updating config:', error);
      return false;
    }
  }, [toast, configs]);

  useEffect(() => {
    fetchConfigs();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('platform-config-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'platform_config',
        },
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchConfigs]);

  const { features, announcement } = parseConfigs(configs);

  return {
    configs,
    features,
    announcement,
    loading,
    updateConfig,
    refetch: fetchConfigs,
  };
}
