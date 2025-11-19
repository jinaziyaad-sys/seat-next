import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Clock } from "lucide-react";

interface FoodExtensionReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (minutes: number, reason: string) => void;
  title?: string;
  description?: string;
}

const predefinedReasons = [
  "Busy period - high order volume",
  "Kitchen delay - unexpected issue",
  "Equipment malfunction",
  "Ingredient preparation taking longer",
  "Staff shortage",
  "Other (please specify)"
];

export function FoodExtensionReasonDialog({
  open,
  onOpenChange,
  onConfirm,
  title = "Extend ETA",
  description = "Select time extension and provide a reason"
}: FoodExtensionReasonDialogProps) {
  const [selectedMinutes, setSelectedMinutes] = useState<number>(5);
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [customReason, setCustomReason] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = () => {
    if (!selectedReason) return;
    
    const finalReason = selectedReason === "Other (please specify)" 
      ? customReason.trim() 
      : selectedReason;

    if (!finalReason) return;

    setIsSubmitting(true);
    onConfirm(selectedMinutes, finalReason);
    
    // Reset form
    setTimeout(() => {
      setSelectedMinutes(5);
      setSelectedReason("");
      setCustomReason("");
      setIsSubmitting(false);
      onOpenChange(false);
    }, 100);
  };

  const isValid = selectedReason && (selectedReason !== "Other (please specify)" || customReason.trim().length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {title}
          </DialogTitle>
          {description && (
            <p className="text-sm text-muted-foreground mt-2">{description}</p>
          )}
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="extension-time">Extension Time</Label>
            <Select
              value={selectedMinutes.toString()}
              onValueChange={(value) => setSelectedMinutes(Number(value))}
            >
              <SelectTrigger id="extension-time">
                <SelectValue placeholder="Select time" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">+5 minutes</SelectItem>
                <SelectItem value="10">+10 minutes</SelectItem>
                <SelectItem value="15">+15 minutes</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="extension-reason">Reason for Extension</Label>
            <Select
              value={selectedReason}
              onValueChange={setSelectedReason}
            >
              <SelectTrigger id="extension-reason">
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {predefinedReasons.map((reason) => (
                  <SelectItem key={reason} value={reason}>
                    {reason}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedReason === "Other (please specify)" && (
            <div className="space-y-2">
              <Label htmlFor="custom-reason">Please specify the reason</Label>
              <Textarea
                id="custom-reason"
                placeholder="Enter the reason for extension..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                maxLength={200}
                className="resize-none"
                rows={3}
              />
              <p className="text-xs text-muted-foreground text-right">
                {customReason.length}/200 characters
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!isValid || isSubmitting}
          >
            {isSubmitting ? "Extending..." : "Confirm Extension"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
