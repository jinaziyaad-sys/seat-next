import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QrCode, Search, UserCheck, Loader2, AlertCircle, Plus, Link } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface LinkPatronDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderNumber: string;
  venueId: string;
  onLinked: () => void;
}

export const LinkPatronDialog = ({
  open,
  onOpenChange,
  orderId,
  orderNumber,
  venueId,
  onLinked,
}: LinkPatronDialogProps) => {
  const [patronCode, setPatronCode] = useState("");
  const [searching, setSearching] = useState(false);
  const [foundPatron, setFoundPatron] = useState<{ id: string; full_name: string; patron_code: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [mode, setMode] = useState<"idle" | "create" | "link-existing">("idle");
  const [newOrderNumber, setNewOrderNumber] = useState("");
  const [unlinkedOrders, setUnlinkedOrders] = useState<{ id: string; order_number: string; created_at: string }[]>([]);
  const [loadingUnlinked, setLoadingUnlinked] = useState(false);
  const { toast } = useToast();

  const hasOrder = !!orderId;

  const resetState = () => {
    setPatronCode("");
    setFoundPatron(null);
    setError(null);
    setSearching(false);
    setLinking(false);
    setMode("idle");
    setNewOrderNumber("");
    setUnlinkedOrders([]);
    setLoadingUnlinked(false);
  };

  const searchPatron = async () => {
    const code = patronCode.trim().toUpperCase();
    if (!code) return;

    setSearching(true);
    setError(null);
    setFoundPatron(null);
    setMode("idle");

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

  const linkPatronToOrder = async (targetOrderId: string, targetOrderNumber: string) => {
    if (!foundPatron) return;

    setLinking(true);

    const { error: updateError } = await supabase
      .from("orders")
      .update({
        user_id: foundPatron.id,
        customer_name: foundPatron.full_name,
      })
      .eq("id", targetOrderId);

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
      description: `Order #${targetOrderNumber} linked to ${foundPatron.full_name}`,
    });

    onLinked();
    onOpenChange(false);
    resetState();
  };

  const createOrderForPatron = async () => {
    if (!foundPatron || !newOrderNumber.trim()) return;

    setLinking(true);

    const { error: insertError } = await supabase.from("orders").insert({
      venue_id: venueId,
      order_number: newOrderNumber.trim(),
      user_id: foundPatron.id,
      customer_name: foundPatron.full_name,
      status: "placed" as const,
      items: [],
    });

    setLinking(false);

    if (insertError) {
      toast({
        title: "Error",
        description: "Could not create order",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Order Created",
      description: `Order #${newOrderNumber.trim()} created for ${foundPatron.full_name}`,
    });

    onLinked();
    onOpenChange(false);
    resetState();
  };

  const fetchUnlinkedOrders = async () => {
    setLoadingUnlinked(true);
    const { data } = await supabase
      .from("orders")
      .select("id, order_number, created_at")
      .eq("venue_id", venueId)
      .is("user_id", null)
      .in("status", ["placed", "in_prep"])
      .order("created_at", { ascending: false })
      .limit(10);

    setUnlinkedOrders(data || []);
    setLoadingUnlinked(false);
  };

  const handleLinkExisting = () => {
    setMode("link-existing");
    fetchUnlinkedOrders();
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
            {hasOrder ? `Link Patron to Order #${orderNumber}` : "Scan Patron"}
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
                  setMode("idle");
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

              {/* Mode A: Link to specific order */}
              {hasOrder && (
                <Button onClick={() => linkPatronToOrder(orderId, orderNumber)} className="w-full" disabled={linking}>
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
              )}

              {/* Mode B: No order pre-selected — show options */}
              {!hasOrder && mode === "idle" && (
                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={() => setMode("create")} variant="default" className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Order
                  </Button>
                  <Button onClick={handleLinkExisting} variant="outline" className="w-full">
                    <Link className="h-4 w-4 mr-2" />
                    Link Existing
                  </Button>
                </div>
              )}

              {/* Create order form */}
              {!hasOrder && mode === "create" && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Order Number</Label>
                    <Input
                      placeholder="e.g. 042"
                      value={newOrderNumber}
                      onChange={(e) => setNewOrderNumber(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && newOrderNumber.trim() && createOrderForPatron()}
                    />
                  </div>
                  <Button
                    onClick={createOrderForPatron}
                    className="w-full"
                    disabled={linking || !newOrderNumber.trim()}
                  >
                    {linking ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating…
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Create Order for {foundPatron.full_name}
                      </>
                    )}
                  </Button>
                  <Button variant="ghost" size="sm" className="w-full" onClick={() => setMode("idle")}>
                    Back
                  </Button>
                </div>
              )}

              {/* Link to existing unlinked order */}
              {!hasOrder && mode === "link-existing" && (
                <div className="space-y-3">
                  {loadingUnlinked ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : unlinkedOrders.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No unlinked orders found
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {unlinkedOrders.map((order) => (
                        <Button
                          key={order.id}
                          variant="outline"
                          className="w-full justify-between"
                          disabled={linking}
                          onClick={() => linkPatronToOrder(order.id, order.order_number)}
                        >
                          <span>Order #{order.order_number}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(order.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </Button>
                      ))}
                    </div>
                  )}
                  <Button variant="ghost" size="sm" className="w-full" onClick={() => setMode("idle")}>
                    Back
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
