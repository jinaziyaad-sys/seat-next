import { X, HelpCircle, MessageSquare, PlayCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { FAQSection } from './FAQSection';
import { AIAssistant } from './AIAssistant';
import { DashboardVariant } from './types';
import {
  merchantFAQs,
  patronFAQs,
  merchantFAQCategories,
  patronFAQCategories,
} from './helpContent';

interface HelpPanelProps {
  variant: DashboardVariant;
  isOpen: boolean;
  onClose: () => void;
  activeTab: 'faq' | 'chat' | 'tour';
  onTabChange: (tab: 'faq' | 'chat' | 'tour') => void;
  onStartTour: () => void;
  onNavigate?: (target: string) => void;
}

export function HelpPanel({
  variant,
  isOpen,
  onClose,
  activeTab,
  onTabChange,
  onStartTour,
  onNavigate,
}: HelpPanelProps) {
  const faqs = variant === 'merchant' ? merchantFAQs : patronFAQs;
  const categories = variant === 'merchant' ? merchantFAQCategories : patronFAQCategories;

  const handleStartTour = () => {
    onClose();
    onStartTour();
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader className="border-b pb-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" />
              Help Center
            </SheetTitle>
          </div>
        </SheetHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => onTabChange(v as 'faq' | 'chat' | 'tour')}
          className="mt-4 flex flex-1 flex-col"
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="faq" className="gap-2">
              <HelpCircle className="h-4 w-4" />
              <span className="hidden sm:inline">FAQ</span>
            </TabsTrigger>
            <TabsTrigger value="chat" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">AI Chat</span>
            </TabsTrigger>
            <TabsTrigger value="tour" className="gap-2">
              <PlayCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Tour</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="faq" className="mt-4 flex-1 overflow-hidden">
            <FAQSection faqs={faqs} categories={categories} />
          </TabsContent>

          <TabsContent value="chat" className="mt-4 flex-1 overflow-hidden">
            <AIAssistant variant={variant} onNavigate={onNavigate} />
          </TabsContent>

          <TabsContent value="tour" className="mt-4 flex-1">
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <PlayCircle className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Interactive Tour</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Take a guided walkthrough of all the features available to you.
                  Perfect for getting started or discovering new capabilities.
                </p>
              </div>
              <Button onClick={handleStartTour} className="mt-4">
                <PlayCircle className="mr-2 h-4 w-4" />
                Start Tour
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
