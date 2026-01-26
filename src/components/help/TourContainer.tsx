import { useState, useEffect, useCallback, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, MousePointer2, Hand } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { TourStep, DashboardVariant } from './types';
import { merchantTourSteps, patronTourSteps } from './helpContent';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  PatronDemoVenueSelect,
  PatronDemoOrderEntry,
  PatronDemoOrderTracking,
  PatronDemoOrderReady,
  PatronDemoWaitlistEntry,
  PatronDemoWaitlistStatus,
  PatronDemoTableReady,
  MerchantDemoKitchenOrders,
  MerchantDemoWaitlist,
  MerchantDemoReservations,
  MerchantDemoSettings,
  MerchantDemoReports,
  MerchantDemoStaff,
} from './TourDemoScreens';

interface TourContainerProps {
  variant: DashboardVariant;
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

// Map step IDs to demo screen components
const patronDemoScreens: Record<string, React.ComponentType> = {
  'patron-demo-venue-select': PatronDemoVenueSelect,
  'patron-demo-order-entry': PatronDemoOrderEntry,
  'patron-demo-order-tracking': PatronDemoOrderTracking,
  'patron-demo-order-ready': PatronDemoOrderReady,
  'patron-demo-waitlist-entry': PatronDemoWaitlistEntry,
  'patron-demo-waitlist-status': PatronDemoWaitlistStatus,
  'patron-demo-table-ready': PatronDemoTableReady,
};

const merchantDemoScreens: Record<string, React.ComponentType> = {
  'merchant-demo-kitchen': MerchantDemoKitchenOrders,
  'merchant-demo-waitlist': MerchantDemoWaitlist,
  'merchant-demo-reservations': MerchantDemoReservations,
  'merchant-demo-settings': MerchantDemoSettings,
  'merchant-demo-reports': MerchantDemoReports,
  'merchant-demo-staff': MerchantDemoStaff,
};

export function TourContainer({ variant, isOpen, onClose, onComplete }: TourContainerProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [tooltipHeight, setTooltipHeight] = useState(200);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const steps = variant === 'merchant' ? merchantTourSteps : patronTourSteps;
  const demoScreens = variant === 'merchant' ? merchantDemoScreens : patronDemoScreens;
  const currentStepData = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  // Get the demo screen for current step (if any)
  const CurrentDemoScreen = currentStepData?.id ? demoScreens[currentStepData.id] : null;

  // Find target element within the demo container or document
  const findTarget = useCallback(() => {
    if (!currentStepData) return null;
    
    // First try to find in demo container
    if (containerRef.current) {
      const element = containerRef.current.querySelector(currentStepData.target);
      if (element) return element;
    }
    
    // Fallback to document
    return document.querySelector(currentStepData.target);
  }, [currentStepData]);

  // Update target position
  useEffect(() => {
    if (!isOpen || !currentStepData) return;

    const updatePosition = () => {
      // Small delay to let demo screen render
      setTimeout(() => {
        const element = findTarget();
        if (element) {
          const rect = element.getBoundingClientRect();
          setTargetRect(rect);
        } else {
          setTargetRect(null);
        }
      }, 100);
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen, currentStep, findTarget, currentStepData]);

  // Measure tooltip height
  useEffect(() => {
    if (tooltipRef.current) {
      const height = tooltipRef.current.getBoundingClientRect().height;
      if (height > 0) {
        setTooltipHeight(height);
      }
    }
  }, [currentStep, isOpen]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleComplete = () => {
    setCurrentStep(0);
    onComplete();
  };

  const handleSkip = () => {
    setCurrentStep(0);
    onClose();
  };

  if (!isOpen) return null;

  const getTooltipPosition = () => {
    if (!targetRect) {
      // Center in right panel
      return { top: '20%', right: '20px' };
    }

    const padding = 16;
    const tooltipWidth = 320;
    const actualHeight = tooltipHeight;
    let placement = currentStepData?.placement || 'right';

    // Position tooltip relative to target in demo screen
    let top = targetRect.top;
    let right = 20;

    // Adjust based on placement
    switch (placement) {
      case 'bottom':
        top = targetRect.bottom + padding;
        break;
      case 'top':
        top = targetRect.top - actualHeight - padding;
        break;
      default:
        top = targetRect.top;
    }

    // Keep in bounds
    top = Math.max(padding, Math.min(top, window.innerHeight - actualHeight - padding));

    return { top: `${top}px`, right: `${right}px` };
  };

  return (
    <div className="fixed inset-0 z-[100] flex">
      {/* Demo Screen Panel - Left side */}
      <div 
        ref={containerRef}
        className="flex-1 bg-background overflow-y-auto relative"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-lg">
              {variant === 'merchant' ? '🏪 Merchant Tour' : '📱 Patron Tour'}
            </h2>
            <Button variant="ghost" size="sm" onClick={handleSkip}>
              <X className="h-4 w-4 mr-1" />
              Exit Tour
            </Button>
          </div>
          <Progress value={progress} className="mt-2 h-1.5" />
        </div>

        {/* Demo Screen Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
          >
            {CurrentDemoScreen ? (
              <CurrentDemoScreen />
            ) : (
              <div className="p-6 text-center text-muted-foreground">
                <p>Demo screen for this step</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Target Highlight */}
        {targetRect && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed pointer-events-none border-2 border-primary rounded-lg"
            style={{
              top: targetRect.top - 4,
              left: targetRect.left - 4,
              width: targetRect.width + 8,
              height: targetRect.height + 8,
              boxShadow: '0 0 0 4px rgba(255,107,53,0.2), 0 0 20px rgba(255,107,53,0.3)',
              zIndex: 101,
            }}
          />
        )}
      </div>

      {/* Tooltip Panel - Right side */}
      <div className="w-[360px] bg-muted/50 border-l flex flex-col">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="flex-1 p-4 flex flex-col"
          >
            <Card ref={tooltipRef} className="shadow-lg border-2 border-primary/50">
              <CardContent className="p-5">
                {/* Step indicator */}
                <div className="mb-3 flex items-center justify-between">
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    Step {currentStep + 1} of {steps.length}
                  </span>
                </div>

                {/* Content */}
                <h3 className="mb-2 text-lg font-bold text-foreground">{currentStepData?.title}</h3>
                <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
                  {currentStepData?.description}
                </p>

                {/* Highlight indicator */}
                {currentStepData?.highlightPulse && (
                  <div className="mb-4 p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <div className="flex items-center gap-2 text-primary">
                      <MousePointer2 className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        {currentStepData.actionLabel || 'Look at the highlighted area'}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Navigation - pushed to bottom */}
            <div className="mt-auto pt-4 flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSkip}
                className="text-muted-foreground hover:text-foreground"
              >
                Skip tour
              </Button>
              <div className="flex gap-2">
                {currentStep > 0 && (
                  <Button variant="outline" size="sm" onClick={handlePrev}>
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Back
                  </Button>
                )}
                <Button size="sm" onClick={handleNext}>
                  {currentStep < steps.length - 1 ? (
                    <>
                      Next
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </>
                  ) : (
                    '🎉 Finish'
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
