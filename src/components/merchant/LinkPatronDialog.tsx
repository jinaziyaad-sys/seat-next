import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QrCode, Search, UserCheck, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface LinkPatronDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderNumber: string;
  onLinked: () => void;
}

export const LinkPatronDialog = ({
  open,
  onOpenChange,
  orderId,
  orderNumber,
  onLinked,
}: LinkPatronDialogProps) => {
  const [patronCode, setPatronCode] = useState("");
  const [searching, setSearching] = useState(false);
  const [foundPatron, setFoundPatron] = useState<{ id: string; full_name: string; patron_code: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const { toast } = useToast();

  const resetState = () => {
    setPatronCode("");
    setFoundPatron(null);
    setError(null);
    setSearching(false);
    setLinking(false);
  };

  const searchPatron = async () => {
    const code = patronCode.trim().toUpperCase();
    if (!code) return;

    setSearching(true);
    setError(null);
    setFoundPatron(null);

    // Try parsing as QR JSON first
    let searchCode = code;
    try {
      const parsed = JSON.parse(code);
      if (parsed.type === "patron" && parsed.code) {
        searchCode = parsed.code;
      }
    } catch {
      // Not JSON, use as-is
    }

    const { data, error: dbError } = await supabase
      .from("profiles")
      .select("id, full_name, patron_code")
      .eq("patron_code", searchCode)
      .maybeSingle();

    setSearching(false);

    if (dbError) {
      setError("Could not search. Please try again.");
      return;
    }

    if (!data) {
      setError(`No patron found with code "${searchCode}"`);
      return;
    }

    setFoundPatron(data as any);
  };

  const linkPatron = async () => {
    if (!foundPatron) return;

    setLinking(true);

    const { error: updateError } = await supabase
      .from("orders")
      .update({
        user_id: foundPatron.id,
        customer_name: foundPatron.full_name,
      })
      .eq("id", orderId);

    setLinking(false);

    if (updateError) {
      toast({
        title: "Error",
        description: "Could not link patron to order",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Patron Linked",
      description: `Order #${orderNumber} linked to ${foundPatron.full_name}`,
    });

    onLinked();
    onOpenChange(false);
    resetState();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetState();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            Link Patron to Order #{orderNumber}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Enter Patron Code</Label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. ZII-4829"
                value={patronCode}
                onChange={(e) => {
                  setPatronCode(e.target.value.toUpperCase());
                  setError(null);
                  setFoundPatron(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && searchPatron()}
                className="font-mono tracking-wider"
              />
              <Button onClick={searchPatron} disabled={searching || !patronCode.trim()}>
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Ask the patron for their code or scan their QR code
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {foundPatron && (
            <div className="space-y-3">
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <UserCheck className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">{foundPatron.full_name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{foundPatron.patron_code}</p>
                  </div>
                </div>
              </div>

              <Button onClick={linkPatron} className="w-full" disabled={linking}>
                {linking ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Linking…
                  </>
                ) : (
                  <>
                    <UserCheck className="h-4 w-4 mr-2" />
                    Link to Order #{orderNumber}
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
