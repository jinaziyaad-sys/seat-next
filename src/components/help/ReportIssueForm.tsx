import { useState, useRef } from 'react';
import { Send, Loader2, Bug, Lightbulb, HelpCircle, FileText, Camera, X, Image } from 'lucide-react';
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
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const location = useLocation();

  const handleScreenshotCapture = async () => {
    setCapturing(true);
    try {
      // Use the Screen Capture API
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'browser' } as MediaTrackConstraints,
        audio: false,
      });

      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();

      // Create canvas and capture frame
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(video, 0, 0);

      // Stop the stream
      stream.getTracks().forEach(track => track.stop());

      // Convert to blob
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `screenshot-${Date.now()}.png`, { type: 'image/png' });
          setScreenshot(file);
          setScreenshotPreview(URL.createObjectURL(file));
        }
      }, 'image/png');
    } catch (err) {
      console.error('Screenshot capture failed:', err);
      // User cancelled or API not supported - don't show error
    } finally {
      setCapturing(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image must be less than 5MB');
        return;
      }
      setScreenshot(file);
      setScreenshotPreview(URL.createObjectURL(file));
    }
  };

  const removeScreenshot = () => {
    setScreenshot(null);
    if (screenshotPreview) {
      URL.revokeObjectURL(screenshotPreview);
      setScreenshotPreview(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadScreenshot = async (file: File): Promise<string | null> => {
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.png`;
    const { error } = await supabase.storage
      .from('issue-screenshots')
      .upload(fileName, file);

    if (error) {
      console.error('Screenshot upload failed:', error);
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('issue-screenshots')
      .getPublicUrl(fileName);

    return publicUrl;
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      toast.error('Please describe the issue');
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Upload screenshot if present
      let screenshotUrl: string | null = null;
      if (screenshot) {
        screenshotUrl = await uploadScreenshot(screenshot);
      }

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
          screenshot_url: screenshotUrl,
        });

      if (error) throw error;

      toast.success('Issue reported successfully! Our team will look into it.');
      setDescription('');
      setCategory('bug');
      removeScreenshot();
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
            rows={4}
            className="resize-none"
          />
        </div>

        <div className="grid gap-2">
          <Label>Screenshot (optional)</Label>
          {screenshotPreview ? (
            <div className="relative rounded-lg border overflow-hidden">
              <img 
                src={screenshotPreview} 
                alt="Screenshot preview" 
                className="w-full h-32 object-cover"
              />
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 h-6 w-6"
                onClick={removeScreenshot}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={handleScreenshotCapture}
                disabled={capturing}
              >
                {capturing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="mr-2 h-4 w-4" />
                )}
                Capture Screen
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => fileInputRef.current?.click()}
              >
                <Image className="mr-2 h-4 w-4" />
                Upload Image
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Add a screenshot to help us understand the issue better
          </p>
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
