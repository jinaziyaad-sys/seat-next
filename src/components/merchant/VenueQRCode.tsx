import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface VenueQRCodeProps {
  venueId: string;
  venueName: string;
}

export const VenueQRCode = ({ venueId, venueName }: VenueQRCodeProps) => {
  const qrValue = `${window.location.origin}/waitlist/${venueId}`;

  const downloadQRCode = () => {
    const svg = document.getElementById(`qr-${venueId}`);
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL("image/png");

      const downloadLink = document.createElement("a");
      downloadLink.download = `${venueName}-waitlist-qr.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };

    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle>Waitlist QR Code</CardTitle>
        <p className="text-sm text-muted-foreground">
          Display this at your venue for customers to join the waitlist
        </p>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <div className="p-4 bg-white rounded-lg">
          <QRCodeSVG
            id={`qr-${venueId}`}
            value={qrValue}
            size={200}
            level="H"
            includeMargin={true}
          />
        </div>
        <div className="text-center">
          <p className="font-semibold">{venueName}</p>
          <p className="text-xs text-muted-foreground">Scan to join waitlist</p>
        </div>
        <Button onClick={downloadQRCode} variant="outline" className="w-full">
          <Download size={16} className="mr-2" />
          Download QR Code
        </Button>
      </CardContent>
    </Card>
  );
};
