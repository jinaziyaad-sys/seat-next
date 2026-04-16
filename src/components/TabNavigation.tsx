import { useState } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Home, UtensilsCrossed, Users, Gift, ClipboardList, User, QrCode } from "lucide-react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PatronIDCard } from "@/components/PatronIDCard";

interface TabNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  badges?: Record<string, number>;
  userId?: string;
}

const tabKeys = [
  { id: "home", labelKey: "nav.home", icon: Home },
  { id: "food-ready", labelKey: "nav.food", icon: UtensilsCrossed },
  { id: "table-ready", labelKey: "nav.table", icon: Users },
  { id: "loyalty", labelKey: "nav.rewardsReady", icon: Gift },
  { id: "activity", labelKey: "nav.activity", icon: ClipboardList },
  { id: "profile", labelKey: "nav.profile", icon: User },
];

export function TabNavigation({ activeTab, onTabChange, badges = {}, userId }: TabNavigationProps) {
  const { t } = useTranslation();
  const [idSheetOpen, setIdSheetOpen] = useState(false);

  return (
    <>
      <Card className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl border-0 bg-card shadow-floating">
        <nav className="flex items-center justify-around p-4" role="tablist" aria-label="Main navigation">
          {tabKeys.map((tab) => {
            const Icon = tab.icon;
            const label = t(tab.labelKey);
            const isActive = activeTab === tab.id || (activeTab === "explore" && tab.id === "home");
            const badgeCount = badges[tab.id] || 0;
            
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                aria-label={label}
                data-tour={`nav-${tab.id === 'food-ready' ? 'food' : tab.id === 'table-ready' ? 'table' : tab.id}`}
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  "relative flex flex-col items-center gap-1 p-3 rounded-xl transition-colors duration-200",
                  "hover:bg-primary/10 active:scale-95 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2",
                  isActive 
                    ? "text-primary-foreground" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="tab-pill"
                    className="absolute inset-0 rounded-xl bg-primary shadow-button"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <div className="relative z-10">
                  <motion.div
                    key={`${tab.id}-${isActive}`}
                    initial={isActive ? { scale: 0.8 } : false}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 20 }}
                  >
                    <Icon size={24} aria-hidden="true" />
                  </motion.div>
                  {badgeCount > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground"
                    >
                      {badgeCount > 9 ? "9+" : badgeCount}
                    </motion.span>
                  )}
                </div>
                <span className="relative z-10 text-xs font-medium">{label}</span>
              </button>
            );
          })}

          {/* My ID button */}
          {userId && (
            <button
              aria-label="My ID"
              onClick={() => setIdSheetOpen(true)}
              className={cn(
                "relative flex flex-col items-center gap-1 p-3 rounded-xl transition-colors duration-200",
                "hover:bg-primary/10 active:scale-95 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2",
                "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 ring-2 ring-primary/30">
                <QrCode size={20} className="text-primary" aria-hidden="true" />
              </div>
              <span className="relative z-10 text-xs font-medium">My ID</span>
            </button>
          )}
        </nav>
      </Card>

      {/* Patron ID Sheet */}
      <Sheet open={idSheetOpen} onOpenChange={setIdSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl px-6 pb-8">
          <SheetHeader className="mb-4">
            <SheetTitle>My Patron ID</SheetTitle>
          </SheetHeader>
          {userId && <PatronIDCard userId={userId} />}
        </SheetContent>
      </Sheet>
    </>
  );
}
