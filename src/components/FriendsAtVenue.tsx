import { useEffect, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface FriendsAtVenueProps {
  venueId: string;
  userId?: string;
}

interface FriendCheckin {
  userId: string;
  name: string;
}

export function FriendsAtVenue({ venueId, userId }: FriendsAtVenueProps) {
  const [friends, setFriends] = useState<FriendCheckin[]>([]);

  useEffect(() => {
    if (!userId) return;

    const fetchFriendsAtVenue = async () => {
      // Get active checkins at this venue (not expired)
      const { data: checkins } = await (supabase
        .from('patron_checkins') as any)
        .select('user_id')
        .eq('venue_id', venueId)
        .gt('expires_at', new Date().toISOString())
        .neq('user_id', userId);

      if (!checkins?.length) return;

      // Get accepted friends
      const { data: connections } = await (supabase
        .from('patron_connections') as any)
        .select('user_id, friend_id')
        .eq('status', 'accepted')
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

      if (!connections?.length) return;

      const friendIds = new Set(
        connections.map((c: any) => c.user_id === userId ? c.friend_id : c.user_id)
      );

      const checkedInFriendIds = checkins
        .map((c: any) => c.user_id)
        .filter((id: string) => friendIds.has(id));

      if (checkedInFriendIds.length === 0) return;

      // Get friend names
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', checkedInFriendIds);

      setFriends(
        (profiles || []).map((p) => ({
          userId: p.id,
          name: p.full_name,
        }))
      );
    };

    fetchFriendsAtVenue();
  }, [venueId, userId]);

  if (friends.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Users className="h-3.5 w-3.5 text-primary" />
      <div className="flex -space-x-1.5">
        {friends.slice(0, 3).map((f) => (
          <Avatar key={f.userId} className="h-5 w-5 border border-background">
            <AvatarFallback className="text-[8px] bg-primary/20 text-primary">
              {f.name.charAt(0)}
            </AvatarFallback>
          </Avatar>
        ))}
      </div>
      <span>
        {friends.length === 1
          ? `${friends[0].name.split(' ')[0]} is here`
          : `${friends.length} friends here`}
      </span>
    </div>
  );
}
