import { useState } from 'react';
import { Send, Loader2, Bug, Lightbulb, HelpCircle, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

interface ReportIssueFormProps {
  source: 'patron' | 'merchant';
  venueId?: string;
  venueName?: string;
  onSuccess?: () => void;
}

export function ReportIssueForm({ source, venueId, venueName, onSuccess }: ReportIssueFormProps) {
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
      onSuccess?.();
    } catch (err) {
      console.error('Failed to submit issue:', err);
      toast.error('Failed to submit issue. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const categories = [
    { value: 'bug', label: 'Bug Report', icon: Bug, description: 'Something isn\'t working correctly' },
    { value: 'suggestion', label: 'Suggestion', icon: Lightbulb, description: 'Ideas for improvement' },
    { value: 'question', label: 'Question', icon: HelpCircle, description: 'Need help understanding something' },
    { value: 'other', label: 'Other', icon: FileText, description: 'General feedback' },
  ];

  return (
    <div className="flex flex-col gap-6 p-1">
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Bug className="h-6 w-6 text-primary" />
        </div>
        <h3 className="mt-3 text-lg font-semibold">Report an Issue</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Help us improve by reporting bugs, suggesting features, or asking questions.
        </p>
      </div>

      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="category">Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger id="category">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  <div className="flex items-center gap-2">
                    <cat.icon className="h-4 w-4" />
                    <span>{cat.label}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {categories.find(c => c.value === category)?.description}
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            placeholder="What happened? What did you expect to happen?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            className="resize-none"
          />
        </div>
      </div>

      <Button 
        onClick={handleSubmit} 
        disabled={submitting || !description.trim()}
        className="w-full"
      >
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Submitting...
          </>
        ) : (
          <>
            <Send className="mr-2 h-4 w-4" />
            Submit Report
          </>
        )}
      </Button>
    </div>
  );
}
