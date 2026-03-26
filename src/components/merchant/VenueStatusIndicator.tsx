import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Clock, Users, ChefHat, Circle, Coffee } from 'lucide-react';
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

interface VenueStatusState {
  is_open: boolean;
  is_on_break: boolean;
  break_reason?: string;
  break_resume_time?: string;
  message: string;
}

export function VenueStatusIndicator({ venueId, settings }: VenueStatusIndicatorProps) {
  const [capacity, setCapacity] = useState<CapacityData>({
    activeOrders: 0,
    activeWaitlist: 0,
    busynessLevel: 'low',
    capacityPercentage: 0,
  });
  const [venueStatus, setVenueStatus] = useState<VenueStatusState>({
    is_open: true,
    is_on_break: false,
    message: '',
  });

  const calculateBusyness = (orders: number, waitlist: number): { level: BusynessLevel; percentage: number } => {
    const totalActive = orders + waitlist;
    if (totalActive <= 3) {
      return { level: 'low', percentage: Math.min((totalActive / 10) * 100, 30) };
    } else if (totalActive <= 8) {
      return { level: 'moderate', percentage: Math.min(30 + ((totalActive - 3) / 5) * 40, 70) };
    } else {
      return { level: 'high', percentage: Math.min(70 + ((totalActive - 8) / 10) * 30, 100) };
    }
  };

  useEffect(() => {
    if (!venueId) return;

    const fetchCounts = async () => {
      // Active orders
      const { count: ordersCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('venue_id', venueId)
        .in('status', ['placed', 'in_prep', 'awaiting_verification']);

      // Walk-ins (no reservation_time)
      const { count: walkInCount } = await supabase
        .from('waitlist_entries')
        .select('*', { count: 'exact', head: true })
        .eq('venue_id', venueId)
        .in('status', ['waiting', 'ready'])
        .is('reservation_time', null);

      // Active reservations within ±30 min window
      const windowStart = new Date(Date.now() - 30 * 60000).toISOString();
      const windowEnd = new Date(Date.now() + 30 * 60000).toISOString();
      const { count: activeResCount } = await supabase
        .from('waitlist_entries')
        .select('*', { count: 'exact', head: true })
        .eq('venue_id', venueId)
        .in('status', ['waiting', 'ready'])
        .not('reservation_time', 'is', null)
        .gte('reservation_time', windowStart)
        .lte('reservation_time', windowEnd);

      const orders = ordersCount || 0;
      const waitlist = (walkInCount || 0) + (activeResCount || 0);
      const { level, percentage } = calculateBusyness(orders, waitlist);

      setCapacity({
        activeOrders: orders,
        activeWaitlist: waitlist,
        busynessLevel: level,
        capacityPercentage: percentage,
      });
    };

    fetchCounts();

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

    const interval = setInterval(fetchCounts, 30000);

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(waitlistChannel);
      clearInterval(interval);
    };
  }, [venueId]);

  useEffect(() => {
    if (!settings) return;

    const checkStatus = () => {
      const businessHours: BusinessHours = settings.business_hours || {};
      const holidayClosures: HolidayClosure[] = settings.holiday_closures || [];
      // Zero grace periods for merchant view — show actual operating status
      const gracePeriods = { last_reservation: 0, last_order: 0, last_waitlist_join: 0 };

      const status = checkVenueStatus(businessHours, holidayClosures, gracePeriods, 'waitlist');
      setVenueStatus({
        is_open: status.is_open,
        is_on_break: status.is_on_break || false,
        break_reason: status.current_break_reason,
        break_resume_time: status.break_ends_at,
        message: status.message,
      });
    };

    checkStatus();
    const interval = setInterval(checkStatus, 60000);
    return () => clearInterval(interval);
  }, [settings]);

  const getStatusColor = (level: BusynessLevel) => {
    switch (level) {
      case 'low': return 'text-green-500';
      case 'moderate': return 'text-yellow-500';
      case 'high': return 'text-red-500';
    }
  };

  const getStatusBgColor = (level: BusynessLevel) => {
    switch (level) {
      case 'low': return 'bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400';
      case 'moderate': return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-700 dark:text-yellow-400';
      case 'high': return 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400';
    }
  };

  const getStatusLabel = (level: BusynessLevel) => {
    switch (level) {
      case 'low': return 'Quiet';
      case 'moderate': return 'Moderate';
      case 'high': return 'Busy';
    }
  };

  const getOpenClosedBadge = () => {
    if (venueStatus.is_on_break) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className="gap-1.5 cursor-help bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400"
            >
              <Coffee className="h-3 w-3" />
              On Break
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <div className="space-y-1">
              <p className="font-medium">On Break</p>
              {venueStatus.break_reason && <p className="text-sm">{venueStatus.break_reason}</p>}
              {venueStatus.break_resume_time && <p className="text-sm">Resumes at {venueStatus.break_resume_time}</p>}
            </div>
          </TooltipContent>
        </Tooltip>
      );
    }

    return (
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
    );
  };

  return (
    <div className="flex items-center gap-3">
      {getOpenClosedBadge()}

      {(venueStatus.is_open || venueStatus.is_on_break) && (
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
