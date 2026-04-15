import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Check, QrCode, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

interface PatronIDCardProps {
  userId: string;
  compact?: boolean;
}

export const PatronIDCard = ({ userId, compact = false }: PatronIDCardProps) => {
  const [patronCode, setPatronCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const fetchCode = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("patron_code")
        .eq("id", userId)
        .single();

      setPatronCode((data as any)?.patron_code ?? null);
      setLoading(false);
    };

    fetchCode();
  }, [userId]);

  const copyCode = async () => {
    if (!patronCode) return;
    await navigator.clipboard.writeText(patronCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <Card className="shadow-card">
        <CardContent className="p-4">
          <Skeleton className="h-8 w-32 mx-auto" />
        </CardContent>
      </Card>
    );
  }

  if (!patronCode) return null;

  // Compact version for home screen
  if (compact) {
    return (
      <Card
        className="shadow-card cursor-pointer press-feedback hover:shadow-floating border-primary/20"
        onClick={() => setExpanded(!expanded)}
      >
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <QrCode className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">My Patron ID</p>
                <p className="font-mono font-bold text-base tracking-wider">{patronCode}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => {
                  e.stopPropagation();
                  copyCode();
                }}
              >
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
              {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </div>
          </div>

          {expanded && (
            <div className="mt-4 flex flex-col items-center gap-3 pt-3 border-t">
              <div className="p-3 bg-white rounded-lg">
                <QRCodeSVG
                  value={JSON.stringify({ type: "patron", code: patronCode, uid: userId })}
                  size={160}
                  level="H"
                  includeMargin
                />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Show this to the restaurant to link your order
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Full version for profile
  return (
    <Card className="shadow-card">
      <CardContent className="p-6 flex flex-col items-center gap-4">
        <div className="flex items-center gap-2">
          <QrCode className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">My Patron ID</h3>
        </div>

        <div className="p-4 bg-white rounded-lg">
          <QRCodeSVG
            value={JSON.stringify({ type: "patron", code: patronCode, uid: userId })}
            size={200}
            level="H"
            includeMargin
          />
        </div>

        <div className="flex items-center gap-3">
          <span className="font-mono text-2xl font-bold tracking-widest">{patronCode}</span>
          <Button variant="outline" size="icon" onClick={copyCode}>
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center max-w-xs">
          Share this code or show the QR code at a venue so they can link your order to your account
        </p>
      </CardContent>
    </Card>
  );
};
