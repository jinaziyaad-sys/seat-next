import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const sizeClasses = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
  xl: "h-16 w-16",
};

interface VenueLogoProps {
  logoUrl?: string | null;
  name: string;
  size?: keyof typeof sizeClasses;
  className?: string;
}

export const VenueLogo = ({ logoUrl, name, size = "md", className }: VenueLogoProps) => {
  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      {logoUrl && <AvatarImage src={logoUrl} alt={name} />}
      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
        {name?.charAt(0)?.toUpperCase() || "?"}
      </AvatarFallback>
    </Avatar>
  );
};
