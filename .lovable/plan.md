

# Move Operations & Cleanup Under Business Hours

## Overview

Move the Operations & Cleanup settings inside the Business Hours & Schedule accordion section. This creates a logical grouping since cleanup timing is directly tied to when the venue closes.

## Current vs. New Structure

```text
Current Layout:                            New Layout:
┌──────────────────────────────────┐      ┌──────────────────────────────────┐
│ ▶ Kitchen Settings               │      │ ▶ Kitchen Settings               │
├──────────────────────────────────┤      ├──────────────────────────────────┤
│ ▶ Operations & Cleanup  ← HERE   │      │ ▶ Waitlist Preferences           │
├──────────────────────────────────┤      ├──────────────────────────────────┤
│ ▶ Waitlist Preferences           │      │ ▶ Pickup Instructions            │
├──────────────────────────────────┤      ├──────────────────────────────────┤
│ ▶ Pickup Instructions            │      │ ▶ Business Hours & Schedule      │
├──────────────────────────────────┤      │   ├─ Regular Hours               │
│ ▶ Business Hours & Schedule      │      │   ├─ Holiday Closures            │
│   ├─ Regular Hours               │      │   ├─ Grace Periods               │
│   ├─ Holiday Closures            │      │   └─ Operations & Cleanup ← HERE │
│   └─ Grace Periods               │      ├──────────────────────────────────┤
├──────────────────────────────────┤      │ ▶ Auto No-Show Settings          │
│ ▶ Auto No-Show Settings          │      └──────────────────────────────────┘
└──────────────────────────────────┘
```

## Implementation

### File to Modify

| File | Change |
|------|--------|
| `src/components/merchant/MerchantSettings.tsx` | Move Operations & Cleanup content into Business Hours accordion as a new Collapsible section |

### Changes

1. **Remove** the standalone Operations & Cleanup `AccordionItem` (lines 712-797)

2. **Add** a new `Collapsible` section inside the Business Hours `AccordionContent` (after Grace Periods), containing:
   - The "Run cleanup at Close of Business?" YES/NO radio toggle
   - The conditional custom time picker
   - The cleanup action switches (cancelled waitlist, rejected orders)

### New Structure Inside Business Hours Accordion

```text
Business Hours & Schedule
├── Collapsible: Regular Business Hours
│     └── Mon-Sun hour configuration
├── Collapsible: Holiday Closures & Special Dates
│     └── Holiday list + add button
├── Collapsible: Grace Periods
│     └── Reservation, Order, Waitlist sliders
└── Collapsible: Operations & Cleanup (NEW)
      ├── YES/NO: Run at close of business?
      ├── (if NO) Custom time picker
      └── Cleanup toggles
```

### Visual Benefit

- All time-related settings are now grouped together
- Cleanup settings make more sense contextually since they reference "close of business"
- One less top-level accordion section = cleaner navigation

---

## Technical Notes

- No state changes required - all existing state variables remain
- The save logic already handles these settings correctly
- Just relocating the UI elements within the same component

