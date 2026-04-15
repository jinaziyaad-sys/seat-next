import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Upload, Trash2, GripVertical, Plus, ExternalLink } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface ClientLogo {
  id: string;
  name: string;
  logo_url: string;
  website_url: string | null;
  sort_order: number;
  is_active: boolean;
}

export const ClientLogosManager = () => {
  const [logos, setLogos] = useState<ClientLogo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchLogos();
  }, []);

  const fetchLogos = async () => {
    const { data } = await supabase
      .from("client_logos")
      .select("*")
      .order("sort_order", { ascending: true });
    setLogos((data as any[]) || []);
    setLoading(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !newName.trim()) {
      toast({ title: "Please enter a client name first", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${Date.now()}-${newName.toLowerCase().replace(/\s+/g, "-")}.${ext}`;
      
      const { error: uploadError } = await supabase.storage
        .from("client-logos")
        .upload(path, file, { cacheControl: "31536000" });

      if (uploadError) throw uploadError;

      const { data: publicUrl } = supabase.storage
        .from("client-logos")
        .getPublicUrl(path);

      const { error: insertError } = await supabase
        .from("client_logos")
        .insert({
          name: newName.trim(),
          logo_url: publicUrl.publicUrl,
          website_url: newUrl.trim() || null,
          sort_order: logos.length,
        });

      if (insertError) throw insertError;

      setNewName("");
      setNewUrl("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      fetchLogos();
      toast({ title: "Client logo added!" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from("client_logos").update({ is_active: active }).eq("id", id);
    setLogos(prev => prev.map(l => l.id === id ? { ...l, is_active: active } : l));
  };

  const deleteLogo = async (logo: ClientLogo) => {
    // Extract filename from URL
    const urlParts = logo.logo_url.split("/client-logos/");
    if (urlParts[1]) {
      await supabase.storage.from("client-logos").remove([urlParts[1]]);
    }
    await supabase.from("client_logos").delete().eq("id", logo.id);
    setLogos(prev => prev.filter(l => l.id !== logo.id));
    toast({ title: "Logo deleted" });
  };

  const moveOrder = async (id: string, direction: "up" | "down") => {
    const idx = logos.findIndex(l => l.id === id);
    if ((direction === "up" && idx === 0) || (direction === "down" && idx === logos.length - 1)) return;

    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    const newLogos = [...logos];
    [newLogos[idx], newLogos[swapIdx]] = [newLogos[swapIdx], newLogos[idx]];
    
    // Update sort orders
    for (let i = 0; i < newLogos.length; i++) {
      newLogos[i].sort_order = i;
      await supabase.from("client_logos").update({ sort_order: i }).eq("id", newLogos[i].id);
    }
    setLogos(newLogos);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add Client Logo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="client-name">Client Name *</Label>
              <Input
                id="client-name"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="e.g. Spur Steak Ranches"
              />
            </div>
            <div>
              <Label htmlFor="client-url">Website URL (optional)</Label>
              <Input
                id="client-url"
                value={newUrl}
                onChange={e => setNewUrl(e.target.value)}
                placeholder="https://example.com"
              />
            </div>
          </div>
          <div>
            <Label>Logo Image</Label>
            <div className="flex items-center gap-3 mt-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || !newName.trim()}
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploading ? "Uploading..." : "Upload Logo"}
              </Button>
              <span className="text-xs text-muted-foreground">PNG or SVG with transparent background recommended</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Existing logos */}
      <Card>
        <CardHeader>
          <CardTitle>Client Logos ({logos.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm">Loading...</p>
          ) : logos.length === 0 ? (
            <p className="text-muted-foreground text-sm">No client logos yet. Add one above.</p>
          ) : (
            <div className="space-y-3">
              {logos.map((logo, idx) => (
                <div
                  key={logo.id}
                  className="flex items-center gap-4 p-3 rounded-lg border bg-card/60"
                >
                  <div className="flex flex-col gap-1">
                    <button
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                      onClick={() => moveOrder(logo.id, "up")}
                      disabled={idx === 0}
                    >
                      ▲
                    </button>
                    <button
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                      onClick={() => moveOrder(logo.id, "down")}
                      disabled={idx === logos.length - 1}
                    >
                      ▼
                    </button>
                  </div>

                  <div className="w-16 h-10 flex items-center justify-center bg-muted/50 rounded">
                    <img src={logo.logo_url} alt={logo.name} className="max-h-8 max-w-14 object-contain" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{logo.name}</p>
                    {logo.website_url && (
                      <a href={logo.website_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary flex items-center gap-1">
                        <ExternalLink className="h-3 w-3" /> {logo.website_url}
                      </a>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <Switch
                      checked={logo.is_active}
                      onCheckedChange={checked => toggleActive(logo.id, checked)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => deleteLogo(logo)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
