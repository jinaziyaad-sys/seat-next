import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink, Monitor, Smartphone } from "lucide-react";

interface UnblockNotificationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type DeviceType = "desktop-chrome" | "android" | "iphone" | null;

export function UnblockNotificationsDialog({
  open,
  onOpenChange,
}: UnblockNotificationsDialogProps) {
  const [selectedDevice, setSelectedDevice] = useState<DeviceType>(null);

  const renderDeviceSelection = () => (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Select your device to see instructions:
      </p>
      <div className="grid gap-2">
        <Button
          variant="outline"
          className="justify-start gap-3"
          onClick={() => setSelectedDevice("desktop-chrome")}
        >
          <Monitor size={18} />
          Chrome / Edge (Desktop)
        </Button>
        <Button
          variant="outline"
          className="justify-start gap-3"
          onClick={() => setSelectedDevice("android")}
        >
          <Smartphone size={18} />
          Android (Chrome)
        </Button>
        <Button
          variant="outline"
          className="justify-start gap-3"
          onClick={() => setSelectedDevice("iphone")}
        >
          <Smartphone size={18} />
          iPhone (Safari)
        </Button>
      </div>
    </div>
  );

  const renderInstructions = () => {
    switch (selectedDevice) {
      case "desktop-chrome":
        return (
          <div className="space-y-4">
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>Click the <strong>lock icon</strong> (or tune icon) to the left of the URL in your browser</li>
              <li>Find <strong>Site settings</strong> or <strong>Permissions</strong></li>
              <li>Set <strong>Notifications → Allow</strong></li>
              <li>Refresh this page and try again</li>
            </ol>
            <p className="text-xs text-muted-foreground">
              Alternative: Go to <code className="bg-muted px-1 rounded">chrome://settings/content/notifications</code> and find this site under "Not allowed"
            </p>
          </div>
        );
      case "android":
        return (
          <div className="space-y-4">
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>Tap the <strong>lock icon</strong> in the address bar</li>
              <li>Tap <strong>Permissions</strong> or <strong>Site settings</strong></li>
              <li>Set <strong>Notifications → Allow</strong></li>
              <li>Refresh the page</li>
            </ol>
            <p className="text-xs text-muted-foreground">
              Also check: Android Settings → Apps → Chrome → Notifications (must be enabled)
            </p>
          </div>
        );
      case "iphone":
        return (
          <div className="space-y-4">
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>Make sure you're on <strong>iOS 16.4 or later</strong></li>
              <li>In Safari, tap <strong>Share</strong> → <strong>Add to Home Screen</strong></li>
              <li>Open the app from your Home Screen</li>
              <li>Go to iPhone <strong>Settings → Notifications</strong></li>
              <li>Find and enable notifications for this app</li>
            </ol>
            <p className="text-xs text-muted-foreground">
              Note: Web notifications on iPhone require iOS 16.4+ and the site must be added to Home Screen
            </p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      onOpenChange(isOpen);
      if (!isOpen) setSelectedDevice(null);
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>How to Enable Notifications</DialogTitle>
          <DialogDescription>
            Notifications are currently blocked in your browser. Follow these steps to enable them.
          </DialogDescription>
        </DialogHeader>

        {selectedDevice ? (
          <div className="space-y-4">
            {renderInstructions()}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedDevice(null)}
              >
                ← Back
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  window.location.reload();
                }}
              >
                Done, refresh page
              </Button>
            </div>
          </div>
        ) : (
          renderDeviceSelection()
        )}
      </DialogContent>
    </Dialog>
  );
}
