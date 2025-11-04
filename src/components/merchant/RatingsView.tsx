import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Rating {
  id: string;
  order_id: string;
  rating: number;
  feedback_text: string | null;
  created_at: string;
  orders: {
    order_number: string;
  };
}

export const RatingsView = ({ venueId }: { venueId: string }) => {
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [averageRating, setAverageRating] = useState(0);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchRatings = async () => {
      const { data, error } = await supabase
        .from("order_ratings")
        .select(`
          *,
          orders (
            order_number
          )
        `)
        .eq("venue_id", venueId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        toast({
          title: "Error",
          description: "Could not load ratings",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      if (data) {
        setRatings(data as any);
        const avg = data.length > 0 
          ? data.reduce((sum, r) => sum + r.rating, 0) / data.length 
          : 0;
        setAverageRating(Math.round(avg * 10) / 10);
      }
      setLoading(false);
    };

    fetchRatings();

    // Real-time subscription
    const channel = supabase
      .channel('ratings-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'order_ratings',
        filter: `venue_id=eq.${venueId}`
      }, () => {
        fetchRatings();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [venueId, toast]);

  if (loading) {
    return <div className="text-center py-8">Loading ratings...</div>;
  }

  const ratingDistribution = [5, 4, 3, 2, 1].map(star => ({
    star,
    count: ratings.filter(r => r.rating === star).length,
    percentage: ratings.length > 0 
      ? Math.round((ratings.filter(r => r.rating === star).length / ratings.length) * 100) 
      : 0
  }));

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Customer Ratings</h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Average Rating</p>
                <p className="text-3xl font-bold">{averageRating}</p>
              </div>
              <Star size={32} className="text-yellow-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Ratings</p>
                <p className="text-3xl font-bold">{ratings.length}</p>
              </div>
              <TrendingUp size={32} className="text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">5-Star Ratings</p>
                <p className="text-3xl font-bold">
                  {ratingDistribution[0].percentage}%
                </p>
              </div>
              <div className="text-4xl">⭐</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rating Distribution */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Rating Distribution</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {ratingDistribution.map(({ star, count, percentage }) => (
            <div key={star} className="flex items-center gap-3">
              <div className="flex items-center gap-1 w-20">
                <span className="font-medium">{star}</span>
                <Star size={16} className="text-yellow-400 fill-yellow-400" />
              </div>
              <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                <div 
                  className="bg-primary h-full transition-all duration-500"
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <span className="text-sm text-muted-foreground w-16">
                {count} ({percentage}%)
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Recent Ratings */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Recent Feedback</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {ratings.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No ratings yet. Encourage customers to rate their orders!
            </p>
          ) : (
            ratings.map((rating) => (
              <div key={rating.id} className="p-4 border rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      #{rating.orders.order_number}
                    </Badge>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span 
                          key={star} 
                          className={star <= rating.rating ? "text-yellow-400" : "text-gray-300"}
                        >
                          ⭐
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(rating.created_at).toLocaleDateString()}
                  </span>
                </div>
                {rating.feedback_text && (
                  <p className="text-sm text-muted-foreground italic pl-2 border-l-2 border-primary/30">
                    "{rating.feedback_text}"
                  </p>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};
