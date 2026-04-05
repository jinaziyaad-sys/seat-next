import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { VenueLogo } from "@/components/VenueLogo";
import { 
  UtensilsCrossed, Users, Clock, ArrowLeft, MessageSquare, 
  Share2, CalendarIcon, AlertTriangle, Inbox
} from "lucide-react";
import { cn, formatTimeUntil } from "@/lib/utils";
import { format, isTomorrow } from "date-fns";

interface ActivityFlowProps {
  onBack: () => void;
  activeOrders: any[];
  activeWaitlist: any[];
  unreadCounts: Record<string, number>;
  onSelectOrder: (order: any) => void;
  onSelectWaitlist: (entry: any) => void;
  onDismissOrder: (id: string) => void;
  onDismissWaitlist: (id: string) => void;
  onRateItem: (item: { type: 'order' | 'waitlist'; id: string; venueId: string; venueName: string }) => void;
  onOpenMessenger: (context: { type: 'order' | 'waitlist'; id: string; venueName: string }) => void;
  onInviteFriends: (entry: any) => void;
}

export function ActivityFlow({
  onBack,
  activeOrders,
  activeWaitlist,
  unreadCounts,
  onSelectOrder,
  onSelectWaitlist,
  onDismissOrder,
  onDismissWaitlist,
  onRateItem,
  onOpenMessenger,
  onInviteFriends,
}: ActivityFlowProps) {
  const { t } = useTranslation();

  // Split into active vs needs-attention
  const activeOrderItems = activeOrders.filter(o => 
    ['awaiting_verification', 'placed', 'in_prep', 'ready'].includes(o.status)
  );
  const attentionOrderItems = activeOrders.filter(o => 
    ['collected', 'rejected'].includes(o.status)
  );
  const activeWaitlistItems = activeWaitlist.filter(e => 
    ['waiting', 'ready'].includes(e.status)
  );
  const attentionWaitlistItems = activeWaitlist.filter(e => 
    ['seated', 'cancelled', 'no_show'].includes(e.status)
  );

  const allActive = [...activeOrderItems, ...activeWaitlistItems];
  const allAttention = [...attentionOrderItems, ...attentionWaitlistItems];
  const isEmpty = allActive.length === 0 && allAttention.length === 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft size={20} />
        </Button>
        <h1 className="text-2xl font-bold">{t("activity.title", "Activity")}</h1>
      </div>

      {isEmpty && (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
          <Inbox size={48} className="mb-4 opacity-40" />
          <p className="text-lg font-medium">{t("activity.empty", "No activity right now")}</p>
          <p className="text-sm mt-1">{t("activity.emptyDesc", "Your orders and waitlist entries will appear here")}</p>
        </div>
      )}

      {/* Active Section */}
      {allActive.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">{t("activity.active", "Active")}</h2>
          {activeOrderItems.map(order => (
            <OrderCard
              key={order.id}
              order={order}
              unreadCount={unreadCounts[order.id] || 0}
              onSelect={() => onSelectOrder(order)}
              onOpenMessenger={() => onOpenMessenger({ type: 'order', id: order.id, venueName: order.venues?.name || 'Restaurant' })}
              t={t}
            />
          ))}
          {activeWaitlistItems.map(entry => (
            <WaitlistCard
              key={entry.id}
              entry={entry}
              unreadCount={unreadCounts[entry.id] || 0}
              onSelect={() => onSelectWaitlist(entry)}
              onOpenMessenger={() => onOpenMessenger({ type: 'waitlist', id: entry.id, venueName: entry.venues?.name || 'Restaurant' })}
              onInviteFriends={() => onInviteFriends(entry)}
              t={t}
            />
          ))}
        </div>
      )}

      {/* Needs Attention Section */}
      {allAttention.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">{t("activity.needsAttention", "Needs Attention")}</h2>
          {attentionOrderItems.map(order => (
            <OrderCard
              key={order.id}
              order={order}
              unreadCount={unreadCounts[order.id] || 0}
              onSelect={() => onSelectOrder(order)}
              onOpenMessenger={() => onOpenMessenger({ type: 'order', id: order.id, venueName: order.venues?.name || 'Restaurant' })}
              onRate={() => order.status === 'collected' ? onRateItem({ type: 'order', id: order.id, venueId: order.venue_id, venueName: order.venues?.name || '' }) : undefined}
              onDismiss={() => order.status === 'rejected' ? onDismissOrder(order.id) : undefined}
              t={t}
            />
          ))}
          {attentionWaitlistItems.map(entry => (
            <WaitlistCard
              key={entry.id}
              entry={entry}
              unreadCount={unreadCounts[entry.id] || 0}
              onSelect={() => onSelectWaitlist(entry)}
              onOpenMessenger={() => onOpenMessenger({ type: 'waitlist', id: entry.id, venueName: entry.venues?.name || 'Restaurant' })}
              onRate={() => entry.status === 'seated' ? onRateItem({ type: 'waitlist', id: entry.id, venueId: entry.venue_id, venueName: entry.venues?.name || '' }) : undefined}
              onDismiss={() => ['cancelled', 'no_show'].includes(entry.status) ? onDismissWaitlist(entry.id) : undefined}
              t={t}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function OrderCard({ order, unreadCount, onSelect, onOpenMessenger, onRate, onDismiss, t }: any) {
  const shouldRate = order.status === 'collected';
  const shouldClear = order.status === 'rejected';

  return (
    <Card className={cn(
      "group shadow-card transition-all cursor-pointer hover:shadow-floating hover:scale-[1.01]",
      order.status === 'ready' && "bg-success/10 border-success animate-pulse-success",
      order.status === 'rejected' && "bg-destructive/10 border-destructive",
      order.status === 'collected' && "bg-success/10 border-success"
    )}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1" onClick={onSelect}>
            <VenueLogo
              logoUrl={order.venues?.logo_url}
              name={order.venues?.name || ''}
              size="lg"
              className={cn(
                order.status === 'ready' ? "ring-2 ring-success" :
                order.status === 'rejected' ? "ring-2 ring-destructive" :
                order.status === 'collected' ? "ring-2 ring-success" : ""
              )}
            />
            <div>
              <span className="inline-block text-xs font-bold uppercase tracking-wider text-white bg-primary px-2 py-0.5 rounded mb-1">
                {t("home.order")}
              </span>
              <h3 className="font-semibold">{order.venues?.name}</h3>
              <p className="text-sm text-muted-foreground">Order #{order.order_number}</p>
              {order.status === 'rejected' && (
                <p className="text-xs text-destructive mt-1">
                  {t("home.cancelledBy", { by: order.cancelled_by === 'patron' ? t("status.you") : order.cancelled_by === 'system' ? t("status.system") : t("status.venue") })}
                </p>
              )}
              {order.eta && (order.status === 'placed' || order.status === 'in_prep') && (
                <div className="space-y-1 mt-1">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock size={12} />
                    <span>
                      {Math.ceil((new Date(order.eta).getTime() - new Date().getTime()) / (1000 * 60))} min • ETA {new Date(order.eta).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}
                    </span>
                  </div>
                  {order.confidence && (
                    <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Badge variant={order.confidence === 'high' ? 'default' : order.confidence === 'medium' ? 'secondary' : 'outline'} className="h-4 text-[9px] px-1">
                        {order.confidence === 'high' ? t("status.highConfidence") : order.confidence === 'medium' ? t("status.medium") : t("status.estimate")}
                      </Badge>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8 relative" onClick={(e) => { e.stopPropagation(); onOpenMessenger(); }}>
              <MessageSquare className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-[10px] text-white flex items-center justify-center font-medium">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>
            <Badge variant={
              order.status === 'ready' ? 'default' :
              order.status === 'in_prep' ? 'default' :
              order.status === 'awaiting_verification' ? 'outline' :
              order.status === 'rejected' ? 'destructive' :
              order.status === 'collected' ? 'default' :
              'secondary'
            }>
              {order.status === 'ready' ? t("status.ready") :
               order.status === 'in_prep' ? t("status.preparing") :
               order.status === 'awaiting_verification' ? t("status.verifying") :
               order.status === 'rejected' ? t("status.cancelled") :
               order.status === 'collected' ? t("status.collected") :
               t("status.placed")}
            </Badge>
            {shouldRate && onRate && (
              <Button variant="default" size="sm" onClick={(e) => { e.stopPropagation(); onRate(); }} className="bg-success hover:bg-success/90">
                {t("home.rate")}
              </Button>
            )}
            {shouldClear && onDismiss && (
              <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onDismiss(); }}>
                {t("home.clear")}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function WaitlistCard({ entry, unreadCount, onSelect, onOpenMessenger, onInviteFriends, onRate, onDismiss, t }: any) {
  const isReservation = entry.reservation_type === 'reservation';
  const reservationTime = entry.reservation_time ? new Date(entry.reservation_time) : null;
  const now = new Date();
  const isUpcomingTime = reservationTime && reservationTime > now;
  const isToday = reservationTime && reservationTime.toDateString() === now.toDateString();
  const isOverdue = isReservation && entry.status === 'waiting' && reservationTime && reservationTime < now;
  const minutesLate = isOverdue && reservationTime ? Math.floor((now.getTime() - reservationTime.getTime()) / 60000) : 0;
  const autoNoShowMinutes = (entry.venues?.settings as any)?.auto_no_show_time || 15;
  const minutesUntilRelease = isOverdue ? Math.max(0, autoNoShowMinutes - minutesLate) : null;
  const shouldRate = entry.status === 'seated';
  const shouldClear = entry.status === 'cancelled' || entry.status === 'no_show';

  return (
    <Card className={cn(
      "group shadow-card transition-all cursor-pointer hover:shadow-floating hover:scale-[1.01]",
      entry.status === 'ready' && "bg-success/10 border-success animate-pulse-success",
      (entry.status === 'cancelled' || entry.status === 'no_show') && "bg-destructive/10 border-destructive",
      entry.status === 'seated' && "bg-success/10 border-success",
      isOverdue && "bg-amber-500/10 border-amber-500 dark:bg-amber-900/20"
    )}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1" onClick={onSelect}>
            <VenueLogo
              logoUrl={entry.venues?.logo_url}
              name={entry.venues?.name || ''}
              size="lg"
              className={cn(
                entry.status === 'ready' ? "ring-2 ring-success" :
                (entry.status === 'cancelled' || entry.status === 'no_show') ? "ring-2 ring-destructive" :
                entry.status === 'seated' ? "ring-2 ring-success" :
                isOverdue ? "ring-2 ring-amber-500" : ""
              )}
            />
            <div>
              <span className={cn(
                "inline-block text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded mb-1",
                isReservation ? "bg-purple-600 text-white" : "bg-secondary text-secondary-foreground"
              )}>
                {isReservation ? t("home.reservation") : t("home.waitlist")}
              </span>
              <h3 className="font-semibold">{entry.venues?.name}</h3>
              {entry.customer_name && <p className="text-xs font-medium text-primary">{entry.customer_name}</p>}
              
              {isReservation && reservationTime ? (
                <>
                  <p className="text-sm text-muted-foreground">{t("home.reservationFor", { size: entry.party_size })}</p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                    <CalendarIcon size={12} />
                    <span>
                      {isTomorrow(reservationTime) ? 'Tomorrow' : isToday ? 'Today' : format(reservationTime, 'MMM d')}
                      {' at '}{format(reservationTime, 'HH:mm')}
                      {isOverdue ? (
                        <span className="text-amber-600 dark:text-amber-400 font-medium">
                          {' • '}{t("home.minLate", { minutes: minutesLate })}
                        </span>
                      ) : isUpcomingTime ? <>{' • '}{formatTimeUntil(reservationTime)}</> : null}
                    </span>
                  </div>
                  {isOverdue && minutesUntilRelease !== null && minutesUntilRelease > 0 && (
                    <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 mt-1">
                      <AlertTriangle size={12} />
                      <span>{t("home.arrivingSoon", { minutes: minutesUntilRelease })}</span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    {t("home.partyOf", { size: entry.party_size })}{entry.position ? ` • #${entry.position}` : ''}
                  </p>
                  {(entry.status === 'cancelled' || entry.status === 'no_show') && (
                    <p className="text-xs text-destructive mt-1">
                      {entry.status === 'no_show' ? t("home.noShowReleased") : t("home.cancelledBy", { by: entry.cancelled_by === 'patron' ? t("status.you") : entry.cancelled_by === 'system' ? t("status.system") : t("status.venue") })}
                    </p>
                  )}
                  {entry.eta && entry.status === 'waiting' && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      <Clock size={12} />
                      <span>{formatTimeUntil(new Date(entry.eta))} • ETA {new Date(entry.eta).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {entry.status === 'waiting' && onInviteFriends && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); onInviteFriends(); }}>
                <Share2 className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8 relative" onClick={(e) => { e.stopPropagation(); onOpenMessenger(); }}>
              <MessageSquare className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-[10px] text-white flex items-center justify-center font-medium">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>
            <Badge variant={
              isOverdue ? 'outline' :
              isReservation ? 'outline' :
              entry.status === 'ready' ? 'default' :
              entry.status === 'cancelled' ? 'destructive' :
              entry.status === 'seated' ? 'default' :
              'secondary'
            } className={cn(isOverdue && "border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-500/10")}>
              {isOverdue ? t("status.overdue") :
               isReservation ? t("status.reserved") :
               entry.status === 'ready' ? t("status.ready") :
               entry.status === 'cancelled' ? t("status.cancelled") :
               entry.status === 'seated' ? t("status.seated") :
               t("status.waiting")}
            </Badge>
            {shouldRate && onRate && (
              <Button variant="default" size="sm" onClick={(e) => { e.stopPropagation(); onRate(); }} className="bg-success hover:bg-success/90">
                {t("home.rate")}
              </Button>
            )}
            {shouldClear && onDismiss && (
              <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onDismiss(); }}>
                {t("home.dismiss")}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
