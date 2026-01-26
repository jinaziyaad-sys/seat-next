import { useState, useEffect, useCallback, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, MousePointer2, Hand } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { TourStep, DashboardVariant } from './types';
import { merchantTourSteps, patronTourSteps } from './helpContent';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface OnboardingTourProps {
  variant: DashboardVariant;
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  onNavigate?: (tab: string) => void;
}

export function OnboardingTour({ variant, isOpen, onClose, onComplete, onNavigate }: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [tooltipHeight, setTooltipHeight] = useState(200);
  const [waitingForClick, setWaitingForClick] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const clickListenerRef = useRef<(() => void) | null>(null);

  const steps = variant === 'merchant' ? merchantTourSteps : patronTourSteps;
  const currentStepData = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  const findTarget = useCallback(() => {
    if (!currentStepData) return null;
    const element = document.querySelector(currentStepData.target);
    return element;
  }, [currentStepData]);

  // Handle step transitions and click detection
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
    
    // Set up click listener for interactive steps
    if (currentStepData.waitForClick && currentStepData.nextStepTrigger === 'click') {
      setWaitingForClick(true);
      
      const element = findTarget();
      if (element) {
        const handleClick = () => {
          setWaitingForClick(false);
          
          // Extract tab name from data-tour attribute for navigation
          const tourAttr = element.getAttribute('data-tour');
          if (tourAttr && onNavigate) {
            // Handle tab navigation for merchant
            if (tourAttr.startsWith('tab-')) {
              const tabName = tourAttr.replace('tab-', '');
              onNavigate(tabName);
            }
            // Handle nav navigation for patron
            if (tourAttr.startsWith('nav-')) {
              const navName = tourAttr.replace('nav-', '');
              onNavigate(navName);
            }
            // Handle card navigation for patron
            if (tourAttr.startsWith('card-')) {
              const cardName = tourAttr.replace('card-', '');
              onNavigate(cardName);
            }
          }
          
          // Small delay to allow navigation to complete before moving to next step
          setTimeout(() => {
            if (currentStep < steps.length - 1) {
              setCurrentStep(prev => prev + 1);
            } else {
              handleComplete();
            }
          }, 300);
        };
        
        element.addEventListener('click', handleClick, { once: true });
        clickListenerRef.current = () => element.removeEventListener('click', handleClick);
      }
    } else {
      setWaitingForClick(false);
    }

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition);
      if (clickListenerRef.current) {
        clickListenerRef.current();
        clickListenerRef.current = null;
      }
    };
  }, [isOpen, currentStep, findTarget, currentStepData, steps.length, onNavigate]);

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
    // Don't allow next if waiting for click interaction
    if (waitingForClick) return;
    
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
    const tooltipWidth = 340;
    const actualHeight = tooltipHeight;
    let placement = currentStepData?.placement || 'bottom';

    let top = 0;
    let left = 0;

    // Check if bottom placement would overflow - if so, try top
    if (placement === 'bottom' && targetRect.bottom + padding + actualHeight > window.innerHeight - padding) {
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

  const isInteractiveStep = currentStepData?.waitForClick && currentStepData?.nextStepTrigger === 'click';

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none">
      {/* Dark overlay - covers everything EXCEPT the cutout area */}
      {targetRect && (
        <>
          {/* Top section */}
          <div 
            className="absolute bg-black/75 pointer-events-auto"
            style={{
              top: 0,
              left: 0,
              right: 0,
              height: Math.max(0, targetRect.top - 8),
            }}
            onClick={handleSkip}
          />
          {/* Bottom section */}
          <div 
            className="absolute bg-black/75 pointer-events-auto"
            style={{
              top: targetRect.bottom + 8,
              left: 0,
              right: 0,
              bottom: 0,
            }}
            onClick={handleSkip}
          />
          {/* Left section */}
          <div 
            className="absolute bg-black/75 pointer-events-auto"
            style={{
              top: targetRect.top - 8,
              left: 0,
              width: Math.max(0, targetRect.left - 8),
              height: targetRect.height + 16,
            }}
            onClick={handleSkip}
          />
          {/* Right section */}
          <div 
            className="absolute bg-black/75 pointer-events-auto"
            style={{
              top: targetRect.top - 8,
              left: targetRect.right + 8,
              right: 0,
              height: targetRect.height + 16,
            }}
            onClick={handleSkip}
          />
        </>
      )}
      
      {/* Fallback full overlay when no target */}
      {!targetRect && (
        <div className="absolute inset-0 bg-black/75 pointer-events-auto" onClick={handleSkip} />
      )}

      {/* Highlight border around target with pulse for interactive steps */}
      {targetRect && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ 
            opacity: 1, 
            scale: 1,
            boxShadow: currentStepData?.highlightPulse 
              ? ['0 0 0 4px rgba(255,107,53,0.3)', '0 0 0 8px rgba(255,107,53,0.5)', '0 0 0 4px rgba(255,107,53,0.3)']
              : '0 0 0 4px rgba(255,107,53,0.3)'
          }}
          transition={{ 
            duration: 0.3,
            boxShadow: currentStepData?.highlightPulse ? {
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut"
            } : undefined
          }}
          className={cn(
            "absolute rounded-lg border-4 border-primary pointer-events-none",
            currentStepData?.highlightPulse && "animate-pulse"
          )}
          style={{
            top: targetRect.top - 8,
            left: targetRect.left - 8,
            width: targetRect.width + 16,
            height: targetRect.height + 16,
            zIndex: 101,
          }}
        />
      )}

      {/* Click indicator for interactive steps */}
      <AnimatePresence>
        {isInteractiveStep && targetRect && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute pointer-events-none"
            style={{
              top: targetRect.top + targetRect.height / 2 - 20,
              left: targetRect.left + targetRect.width + 16,
              zIndex: 102,
            }}
          >
            <motion.div
              animate={{ x: [0, 5, 0] }}
              transition={{ duration: 0.8, repeat: Infinity }}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-3 py-2 rounded-full shadow-lg"
            >
              <Hand className="h-5 w-5" />
              <span className="text-sm font-medium whitespace-nowrap">Click here!</span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tooltip Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="pointer-events-auto"
        >
          <Card
            ref={tooltipRef}
            className="absolute w-[340px] max-h-[85vh] overflow-y-auto border-2 border-primary bg-card shadow-2xl"
            style={{ ...getTooltipPosition(), zIndex: 103 }}
          >
            <CardContent className="p-5">
              {/* Header */}
              <div className="mb-3 flex items-center justify-between">
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  Step {currentStep + 1} of {steps.length}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive"
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

              {/* Interactive action indicator */}
              {isInteractiveStep && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mb-4 p-3 rounded-lg bg-primary/10 border border-primary/20"
                >
                  <div className="flex items-center gap-2 text-primary">
                    <MousePointer2 className="h-4 w-4" />
                    <span className="text-sm font-medium">{currentStepData.actionLabel}</span>
                  </div>
                </motion.div>
              )}

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
                  {!isInteractiveStep && (
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
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}