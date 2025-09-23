import { useState } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { UtensilsCrossed, Users, User, QrCode } from "lucide-react";

interface TabNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const tabs = [
  { id: "food-ready", label: "Food Ready", icon: UtensilsCrossed },
  { id: "table-ready", label: "Table Ready", icon: Users },
  { id: "profile", label: "Profile", icon: User },
];

export function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  return (
    <Card className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl border-0 bg-card shadow-floating">
      <nav className="flex items-center justify-around p-4">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex flex-col items-center gap-1 p-3 rounded-xl transition-all duration-300",
                "hover:bg-primary/10 active:scale-95",
                isActive 
                  ? "bg-primary text-primary-foreground shadow-button" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon 
                size={24} 
                className={cn(
                  "transition-transform duration-300",
                  isActive && "scale-110"
                )} 
              />
              <span className="text-xs font-medium">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </Card>
  );
}

export function QRSimulateButton({ onPress }: { onPress: () => void }) {
  return (
    <button
      onClick={onPress}
      className="fixed top-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-button transition-all duration-300 hover:scale-105 active:scale-95"
    >
      <QrCode size={24} />
    </button>
  );
}