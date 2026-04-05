import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Home, UtensilsCrossed, Users, User, ClipboardList } from "lucide-react";
import { useTranslation } from "react-i18next";

interface TabNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const tabKeys = [
  { id: "home", labelKey: "nav.home", icon: Home },
  { id: "food-ready", labelKey: "nav.food", icon: UtensilsCrossed },
  { id: "table-ready", labelKey: "nav.table", icon: Users },
  { id: "loyalty", labelKey: "nav.loyalty", icon: Gift },
  { id: "profile", labelKey: "nav.profile", icon: User },
];

export function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  const { t } = useTranslation();
  return (
    <Card className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl border-0 bg-card shadow-floating">
      <nav className="flex items-center justify-around p-4" role="tablist" aria-label="Main navigation">
        {tabKeys.map((tab) => {
          const Icon = tab.icon;
          const label = t(tab.labelKey);
          const isActive = activeTab === tab.id || (activeTab === "explore" && tab.id === "home");
          
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-label={label}
              data-tour={`nav-${tab.id === 'food-ready' ? 'food' : tab.id === 'table-ready' ? 'table' : tab.id}`}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex flex-col items-center gap-1 p-3 rounded-xl transition-all duration-300",
                "hover:bg-primary/10 active:scale-95 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2",
                isActive 
                  ? "bg-primary text-primary-foreground shadow-button" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon 
                size={24} 
                aria-hidden="true"
                className={cn(
                  "transition-transform duration-300",
                  isActive && "scale-110"
                )} 
              />
              <span className="text-xs font-medium">{label}</span>
            </button>
          );
        })}
      </nav>
    </Card>
  );
}
