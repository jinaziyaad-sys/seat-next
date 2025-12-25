import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Clock, Users, ChefHat, Circle } from 'lucide-react';
import { checkVenueStatus, BusinessHours, HolidayClosure } from '@/utils/businessHours';

interface VenueStatusIndicatorProps {
  venueId: string;
  settings?: any;
}

type BusynessLevel = 'low' | 'moderate' | 'high';

interface CapacityData {
  activeOrders: number;
  activeWaitlist: number;
  busynessLevel: BusynessLevel;
  capacityPercentage: number;
}

export function VenueStatusIndicator({ venueId, settings }: VenueStatusIndicatorProps) {
  const [capacity, setCapacity] = useState<CapacityData>({
    activeOrders: 0,
    activeWaitlist: 0,
    busynessLevel: 'low',
    capacityPercentage: 0,
  });
  const [venueStatus, setVenueStatus] = useState<{ is_open: boolean; message: string }>({
    is_open: true,
    message: '',
  });

  // Calculate busyness level based on active orders and waitlist
  const calculateBusyness = (orders: number, waitlist: number): { level: BusynessLevel; percentage: number } => {
    // Thresholds can be adjusted based on venue capacity
    const totalActive = orders + waitlist;
    
    if (totalActive <= 3) {
      return { level: 'low', percentage: Math.min((totalActive / 10) * 100, 30) };
    } else if (totalActive <= 8) {
      return { level: 'moderate', percentage: Math.min(30 + ((totalActive - 3) / 5) * 40, 70) };
    } else {
      return { level: 'high', percentage: Math.min(70 + ((totalActive - 8) / 10) * 30, 100) };
    }
  };

  // Fetch active counts
  useEffect(() => {
    if (!venueId) return;

    const fetchCounts = async () => {
      // Fetch active orders (placed, in_prep, awaiting_verification)
      const { count: ordersCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('venue_id', venueId)
        .in('status', ['placed', 'in_prep', 'awaiting_verification']);

      // Fetch active waitlist (waiting, ready)
      const { count: waitlistCount } = await supabase
        .from('waitlist_entries')
        .select('*', { count: 'exact', head: true })
        .eq('venue_id', venueId)
        .in('status', ['waiting', 'ready']);

      const orders = ordersCount || 0;
      const waitlist = waitlistCount || 0;
      const { level, percentage } = calculateBusyness(orders, waitlist);

      setCapacity({
        activeOrders: orders,
        activeWaitlist: waitlist,
        busynessLevel: level,
        capacityPercentage: percentage,
      });
    };

    fetchCounts();

    // Set up real-time subscriptions
    const ordersChannel = supabase
      .channel(`venue-orders-status-${venueId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `venue_id=eq.${venueId}` }, () => {
        fetchCounts();
      })
      .subscribe();

    const waitlistChannel = supabase
      .channel(`venue-waitlist-status-${venueId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'waitlist_entries', filter: `venue_id=eq.${venueId}` }, () => {
        fetchCounts();
      })
      .subscribe();

    // Update counts every 30 seconds as backup
    const interval = setInterval(fetchCounts, 30000);

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(waitlistChannel);
      clearInterval(interval);
    };
  }, [venueId]);

  // Check venue open/closed status
  useEffect(() => {
    if (!settings) return;

    const checkStatus = () => {
      const businessHours: BusinessHours = settings.business_hours || {};
      const holidayClosures: HolidayClosure[] = settings.holiday_closures || [];
      const gracePeriods = {
        last_reservation: settings.last_reservation_before_close || 0,
        last_order: settings.last_order_before_close || 15,
        last_waitlist_join: settings.last_waitlist_before_close || 30,
      };

      const status = checkVenueStatus(businessHours, holidayClosures, gracePeriods, 'waitlist');
      setVenueStatus({ is_open: status.is_open || status.is_on_break === false, message: status.message });
    };

    checkStatus();
    // Update status every minute
    const interval = setInterval(checkStatus, 60000);

    return () => clearInterval(interval);
  }, [settings]);

  const getStatusColor = (level: BusynessLevel) => {
    switch (level) {
      case 'low':
        return 'text-green-500';
      case 'moderate':
        return 'text-yellow-500';
      case 'high':
        return 'text-red-500';
    }
  };

  const getStatusBgColor = (level: BusynessLevel) => {
    switch (level) {
      case 'low':
        return 'bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400';
      case 'moderate':
        return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-700 dark:text-yellow-400';
      case 'high':
        return 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400';
    }
  };

  const getStatusLabel = (level: BusynessLevel) => {
    switch (level) {
      case 'low':
        return 'Quiet';
      case 'moderate':
        return 'Moderate';
      case 'high':
        return 'Busy';
    }
  };

  return (
    <div className="flex items-center gap-3">
      {/* Business Hours Status */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className={`gap-1.5 cursor-help ${
              venueStatus.is_open 
                ? 'bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400' 
                : 'bg-muted border-muted-foreground/30 text-muted-foreground'
            }`}
          >
            <Clock className="h-3 w-3" />
            {venueStatus.is_open ? 'Open' : 'Closed'}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>{venueStatus.message || 'Business hours status'}</p>
        </TooltipContent>
      </Tooltip>

      {/* Busyness Indicator */}
      {venueStatus.is_open && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant="outline" 
              className={`gap-1.5 cursor-help ${getStatusBgColor(capacity.busynessLevel)}`}
            >
              <Circle className={`h-2 w-2 fill-current ${getStatusColor(capacity.busynessLevel)}`} />
              {getStatusLabel(capacity.busynessLevel)}
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <div className="space-y-1.5">
              <p className="font-medium">Current Activity</p>
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1">
                  <ChefHat className="h-3 w-3" />
                  {capacity.activeOrders} orders
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {capacity.activeWaitlist} waiting
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5 mt-2">
                <div 
                  className={`h-1.5 rounded-full transition-all ${
                    capacity.busynessLevel === 'low' ? 'bg-green-500' :
                    capacity.busynessLevel === 'moderate' ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${capacity.capacityPercentage}%` }}
                />
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
