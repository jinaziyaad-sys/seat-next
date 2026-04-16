

# Add Camera-Based QR Code Scanner to Scan Patron Dialog

## Problem
The "Scan Patron" dialog only supports manual text entry of the patron code. Patrons have a QR code on their ID card (containing `{ type: "patron", code: "ZII-4829", uid: "..." }`), but merchants have no way to scan it with their device camera.

## Solution
Add a camera-based QR scanner to the `LinkPatronDialog` using the `html5-qrcode` library. When the merchant taps "Scan QR", the device camera opens inline in the dialog. Once a QR code is detected, it auto-parses the JSON payload and triggers the patron search automatically.

### Changes

**1. Install `html5-qrcode` package**

**2. `src/components/merchant/LinkPatronDialog.tsx`**
- Add a "Scan QR" toggle button next to the manual input
- When active, render an `Html5QrcodeScanner` (or `Html5Qrcode` programmatically) inside the dialog
- On successful scan, parse the JSON value (`{ type: "patron", code, uid }`), extract the `code`, set it in the input field, and auto-trigger `searchPatron()`
- Stop the camera when the dialog closes or scan succeeds
- Graceful fallback: if camera access is denied, show a message asking the merchant to type the code manually

### Technical details

```typescript
// On QR decode success:
const onScanSuccess = (decodedText: string) => {
  try {
    const parsed = JSON.parse(decodedText);
    if (parsed.type === "patron" && parsed.code) {
      setPatronCode(parsed.code);
      // Auto-trigger search
      searchPatronByCode(parsed.code);
    }
  } catch {
    // Try as raw patron code
    setPatronCode(decodedText.toUpperCase());
  }
  stopScanner();
};
```

The scanner will be contained in a `div` inside the dialog, replacing the input area when active. A toggle lets merchants switch between camera scan and manual entry.

