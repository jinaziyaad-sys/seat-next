import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
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
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setRating(0);
      setHoveredRating(0);
      setFeedback("");
      setIsSubmitting(false);
      setSubmitted(false);
    }
  }, [open]);

  const handleSkip = () => {
    onComplete();
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      toast({
        title: t("rating.ratingRequired"),
        description: t("rating.ratingRequiredDesc"),
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
            title: t("rating.alreadyRated"),
            description: t("rating.alreadyRatedDesc"),
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
            title: t("rating.alreadyRated"),
            description: t("rating.alreadyRatedDesc"),
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
        title: t("rating.thanks"),
        description: t("rating.thanksDesc"),
      });

      setSubmitted(true);
    } catch (error: any) {
      console.error("Error submitting rating:", error);
      toast({
        title: t("common.error"),
        description: error.message || t("rating.failedSubmit"),
        variant: "destructive"
      });
      setIsSubmitting(false);
    }
  };

  const handleShare = () => {
    const url = `${window.location.origin}/waitlist/${venueId}`;
    const text = `I rated ${venueName} ${rating}/5 ⭐ on ReadyUp!`;
    if (navigator.share) {
      navigator.share({ title: venueName, text, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(`${text} ${url}`);
      toast({ title: "Link copied!" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {submitted ? (
          <div className="text-center py-6 space-y-4">
            <div className="text-4xl">🎉</div>
            <h3 className="text-xl font-bold">{t("rating.thanks")}</h3>
            <p className="text-muted-foreground">{t("rating.thanksDesc")}</p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={handleShare} className="gap-2">
                <Share2 className="h-4 w-4" />
                {t("rating.shareExperience")}
              </Button>
              <Button onClick={onComplete}>{t("common.close")}</Button>
            </div>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t("rating.title")}</DialogTitle>
              <DialogDescription>
                {t("rating.subtitle", { venue: venueName })}
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
                  {t("rating.feedback")}
                </label>
                <Textarea
                  placeholder={t("rating.feedbackPlaceholder")}
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
                {t("rating.skip")}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || rating === 0}
                className="flex-1"
              >
                {isSubmitting ? t("rating.submitting") : t("rating.submit")}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
