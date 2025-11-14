import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface RatingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'order' | 'waitlist';
  itemId: string;
  venueId: string;
  venueName: string;
  userId: string | null;
  onComplete: () => void;
}

export const RatingDialog = ({
  open,
  onOpenChange,
  type,
  itemId,
  venueId,
  venueName,
  userId,
  onComplete
}: RatingDialogProps) => {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setRating(0);
      setHoveredRating(0);
      setFeedback("");
      setIsSubmitting(false);
    }
  }, [open]);

  const handleSkip = () => {
    onComplete();
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      toast({
        title: "Rating Required",
        description: "Please select a star rating before submitting.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      if (type === 'order') {
        // Check if rating already exists
        const { data: existingRating } = await supabase
          .from('order_ratings')
          .select('id')
          .eq('order_id', itemId)
          .single();

        if (existingRating) {
          toast({
            title: "Already Rated",
            description: "You've already rated this experience.",
          });
          onComplete();
          return;
        }

        // Insert rating
        const { error } = await supabase
          .from('order_ratings')
          .insert({
            order_id: itemId,
            venue_id: venueId,
            user_id: userId,
            rating: rating,
            feedback_text: feedback || null
          });

        if (error) throw error;
      } else {
        // Check if rating already exists
        const { data: existingRating } = await supabase
          .from('waitlist_ratings')
          .select('id')
          .eq('waitlist_entry_id', itemId)
          .single();

        if (existingRating) {
          toast({
            title: "Already Rated",
            description: "You've already rated this experience.",
          });
          onComplete();
          return;
        }

        // Insert rating
        const { error } = await supabase
          .from('waitlist_ratings')
          .insert({
            waitlist_entry_id: itemId,
            venue_id: venueId,
            user_id: userId,
            rating: rating,
            feedback_text: feedback || null
          });

        if (error) throw error;
      }

      toast({
        title: "Thank You!",
        description: "Your rating has been submitted.",
      });

      onComplete();
    } catch (error: any) {
      console.error("Error submitting rating:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit rating. Please try again.",
        variant: "destructive"
      });
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rate Your Experience</DialogTitle>
          <DialogDescription>
            How was your experience at {venueName}?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Star Rating */}
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(0)}
                className="transition-transform hover:scale-110 focus:outline-none"
              >
                <Star
                  size={40}
                  className={cn(
                    "transition-colors",
                    (hoveredRating >= star || rating >= star)
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-muted-foreground"
                  )}
                />
              </button>
            ))}
          </div>

          {/* Optional Feedback */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Additional Feedback (Optional)
            </label>
            <Textarea
              placeholder="Share more details about your experience..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              maxLength={500}
              rows={4}
            />
            <p className="text-xs text-muted-foreground text-right">
              {feedback.length}/500
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handleSkip}
            disabled={isSubmitting}
            className="flex-1"
          >
            Skip
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || rating === 0}
            className="flex-1"
          >
            {isSubmitting ? "Submitting..." : "Submit Rating"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
