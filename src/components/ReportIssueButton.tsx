import { useState } from 'react';
import { Bug, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useLocation } from 'react-router-dom';

interface ReportIssueButtonProps {
  source: 'patron' | 'merchant';
  venueId?: string;
  venueName?: string;
}

export function ReportIssueButton({ source, venueId, venueName }: ReportIssueButtonProps) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<string>('bug');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const location = useLocation();

  const handleSubmit = async () => {
    if (!description.trim()) {
      toast.error('Please describe the issue');
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Get browser and device info
      const browserInfo = navigator.userAgent;
      const deviceInfo = `${navigator.platform} | ${window.screen.width}x${window.screen.height}`;

      const { error } = await supabase
        .from('platform_errors')
        .insert({
          error_type: category,
          error_message: description.trim(),
          source,
          venue_id: venueId || null,
          venue_name: venueName || null,
          issue_category: category,
          route: location.pathname,
          user_id: user?.id || null,
          browser_info: browserInfo,
          device_info: deviceInfo,
          status: 'new',
        });

      if (error) throw error;

      toast.success('Issue reported successfully! Our team will look into it.');
      setDescription('');
      setCategory('bug');
      setOpen(false);
    } catch (err) {
      console.error('Failed to submit issue:', err);
      toast.error('Failed to submit issue. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 text-muted-foreground hover:text-foreground"
        >
          <Bug className="h-4 w-4" />
          <span className="hidden sm:inline">Report Issue</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Report an Issue</DialogTitle>
          <DialogDescription>
            Help us improve by reporting bugs, suggesting features, or asking questions.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="category">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bug">🐛 Bug Report</SelectItem>
                <SelectItem value="suggestion">💡 Suggestion</SelectItem>
                <SelectItem value="question">❓ Question</SelectItem>
                <SelectItem value="other">📝 Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="What happened? What did you expect to happen?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Submit
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
