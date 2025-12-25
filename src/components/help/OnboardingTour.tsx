import { useState, useEffect, useCallback, useRef } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { TourStep, DashboardVariant } from './types';
import { merchantTourSteps, patronTourSteps } from './helpContent';

interface OnboardingTourProps {
  variant: DashboardVariant;
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export function OnboardingTour({ variant, isOpen, onClose, onComplete }: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [tooltipHeight, setTooltipHeight] = useState(200);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const steps = variant === 'merchant' ? merchantTourSteps : patronTourSteps;
  const currentStepData = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  const findTarget = useCallback(() => {
    if (!currentStepData) return null;
    const element = document.querySelector(currentStepData.target);
    return element;
  }, [currentStepData]);

  useEffect(() => {
    if (!isOpen || !currentStepData) return;

    const updatePosition = () => {
      const element = findTarget();
      if (element) {
        const rect = element.getBoundingClientRect();
        setTargetRect(rect);
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        setTargetRect(null);
      }
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition);
    };
  }, [isOpen, currentStep, findTarget, currentStepData]);

  // Measure actual tooltip height after render
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
      return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    }

    const padding = 20;
    const tooltipWidth = 320;
    const actualHeight = tooltipHeight;
    let placement = currentStepData?.placement || 'bottom';

    let top = 0;
    let left = 0;

    // Check if bottom placement would overflow - if so, try top
    if (placement === 'bottom' && targetRect.bottom + padding + actualHeight > window.innerHeight - padding) {
      // Not enough room below, try above
      if (targetRect.top - padding - actualHeight > padding) {
        placement = 'top';
      }
    }

    switch (placement) {
      case 'top':
        top = targetRect.top - actualHeight - padding;
        left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
        break;
      case 'bottom':
        top = targetRect.bottom + padding;
        left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
        break;
      case 'left':
        top = targetRect.top + targetRect.height / 2 - actualHeight / 2;
        left = targetRect.left - tooltipWidth - padding;
        break;
      case 'right':
        top = targetRect.top + targetRect.height / 2 - actualHeight / 2;
        left = targetRect.right + padding;
        break;
    }

    // Keep tooltip in viewport with generous margins
    const maxLeft = window.innerWidth - tooltipWidth - padding;
    const maxTop = window.innerHeight - actualHeight - padding;
    left = Math.max(padding, Math.min(left, maxLeft));
    top = Math.max(padding, Math.min(top, maxTop));

    return { top: `${top}px`, left: `${left}px` };
  };

  // Generate clip-path for the spotlight cutout
  const getClipPath = () => {
    if (!targetRect) return 'none';
    
    const padding = 8;
    const x = targetRect.left - padding;
    const y = targetRect.top - padding;
    const w = targetRect.width + padding * 2;
    const h = targetRect.height + padding * 2;
    const r = 8; // border radius

    // Create a polygon that covers everything except the target area
    return `polygon(
      0% 0%, 
      0% 100%, 
      ${x}px 100%, 
      ${x}px ${y + r}px,
      ${x + r}px ${y}px,
      ${x + w - r}px ${y}px,
      ${x + w}px ${y + r}px,
      ${x + w}px ${y + h - r}px,
      ${x + w - r}px ${y + h}px,
      ${x + r}px ${y + h}px,
      ${x}px ${y + h - r}px,
      ${x}px 100%,
      100% 100%, 
      100% 0%
    )`;
  };

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Dark overlay with cutout - NO blur */}
      <div 
        className="absolute inset-0 bg-black/70 transition-all duration-300"
        style={{ clipPath: targetRect ? getClipPath() : 'none' }}
      />

      {/* Highlight border around target */}
      {targetRect && (
        <div
          className="absolute z-[101] rounded-lg border-4 border-primary shadow-[0_0_0_4px_rgba(255,107,53,0.3)] transition-all duration-300 pointer-events-none"
          style={{
            top: targetRect.top - 8,
            left: targetRect.left - 8,
            width: targetRect.width + 16,
            height: targetRect.height + 16,
          }}
        />
      )}

      {/* Tooltip Card - solid background, high contrast */}
      <Card
        ref={tooltipRef}
        className="absolute z-[102] w-80 max-h-[85vh] overflow-y-auto border-2 border-primary bg-card shadow-2xl"
        style={getTooltipPosition()}
      >
        <CardContent className="p-4">
          {/* Header */}
          <div className="mb-3 flex items-center justify-between">
            <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
              Step {currentStep + 1} of {steps.length}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleSkip}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Progress */}
          <Progress value={progress} className="mb-4 h-2" />

          {/* Content */}
          <h3 className="mb-2 text-lg font-bold text-foreground">{currentStepData?.title}</h3>
          <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
            {currentStepData?.description}
          </p>

          {/* Navigation */}
          <div className="flex items-center justify-between">
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
                  'Finish'
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
