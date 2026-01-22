import { ChevronDown, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import type { AppRole } from "@/hooks/useAuth";

interface UserRole {
  role: AppRole;
  venue_id: string | null;
  venue_name?: string;
}

interface VenueSwitcherProps {
  currentVenue: UserRole;
  allVenues: UserRole[];
  onVenueChange: (venueId: string) => void;
}

export const VenueSwitcher = ({ currentVenue, allVenues, onVenueChange }: VenueSwitcherProps) => {
  // Only show if user has multiple venues
  if (allVenues.length <= 1) {
    return (
      <div className="flex items-center gap-2">
        <Building2 className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-2xl font-bold text-primary">{currentVenue.venue_name}</h1>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-auto p-2 hover:bg-accent/50 gap-2" animate={false}>
          <Building2 className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-2xl font-bold text-primary">{currentVenue.venue_name}</h1>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {allVenues.map((venue) => (
          <DropdownMenuItem
            key={venue.venue_id}
            onClick={() => venue.venue_id && onVenueChange(venue.venue_id)}
            className="flex items-center justify-between cursor-pointer"
          >
            <span className={venue.venue_id === currentVenue.venue_id ? "font-semibold" : ""}>
              {venue.venue_name}
            </span>
            <div className="flex items-center gap-2">
              <Badge 
                variant={venue.role === 'admin' ? 'default' : 'secondary'} 
                className="text-xs"
              >
                {venue.role === 'admin' ? 'Admin' : 'Staff'}
              </Badge>
              {venue.venue_id === currentVenue.venue_id && (
                <span className="text-primary">✓</span>
              )}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
