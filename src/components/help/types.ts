export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
}

export interface TourStep {
  id: string;
  target: string; // CSS selector or element ID
  title: string;
  description: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  action?: NavigationAction;
}

export interface NavigationAction {
  type: 'navigate';
  target: string;
  label: string;
}

export type DashboardVariant = 'merchant' | 'patron';

export interface HelpContextType {
  variant: DashboardVariant;
  isOpen: boolean;
  activeTab: 'faq' | 'chat' | 'tour';
  setIsOpen: (open: boolean) => void;
  setActiveTab: (tab: 'faq' | 'chat' | 'tour') => void;
  startTour: () => void;
  navigateTo?: (target: string) => void;
}
