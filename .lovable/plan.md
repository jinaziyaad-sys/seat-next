

# Loyalty System Redesign: Stamp Cards with Visual Circles

## What We're Building

A fully redesigned loyalty experience with three layers:

1. **"Loyalty" tab in bottom nav** — a new 5th tab (Gift icon) alongside Home, Food Ready, Table Ready, Profile
2. **Loyalty Hub page** — shows all venues the user has loyalty programs with, displayed as circular logos in a grid
3. **Stamp Page per venue** — two inner tabs:
   - **Stamps**: visual circle grid showing filled/unfilled stamps with animations
   - **Vouchers**: list of earned discount codes/rewards

## User Flow

```text
Bottom Nav: [Home] [Food] [Table] [Loyalty] [Profile]
                                     │
                              Loyalty Hub
                    ┌─────────────────────────────┐
                    │  🔵 Restaurant A   🔵 Rest B │
                    │  🔵 Restaurant C   🔵 Rest D │
                    └─────────────────────────────┘
                              │ tap logo
                              ▼
                    ┌─────────────────────────────┐
                    │  ← Back    Restaurant A     │
                    │  [Stamps]  [Vouchers]        │
                    │                              │
                    │   ◉ ◉ ◉ ◉ ○                 │
                    │   ◉ ◉ ○ ○ ○                 │
                    │   5/10 stamps                │
                    │   Next: Free Coffee          │
                    └─────────────────────────────┘
```

## Technical Plan

### 1. Update TabNavigation — add Loyalty tab
- Add `{ id: "loyalty", labelKey: "nav.loyalty", icon: Gift }` to `tabKeys` array
- Change grid from 4 to 5 columns

### 2. Create `LoyaltyReadyFlow.tsx` — the main loyalty component
- Top-level component (same pattern as FoodReadyFlow/TableReadyFlow)
- Props: `onBack: () => void`
- **State machine**: `hub` view → `venue` view (selected venue)
- Reuses the existing `fetchLoyaltyData` logic from PatronLoyaltyCard

#### Hub View (default)
- Header with back arrow and "Loyalty" title
- Grid of venue logos (circular, using VenueLogo component)
- Each logo shows venue name below + a small badge if rewards are available
- Tap a logo → transition to venue stamp page

#### Venue Stamp Page
- Back arrow returns to hub
- Venue name + logo at top
- Two tabs: **Stamps** | **Vouchers**

**Stamps tab:**
- Large circle grid (5 per row) — each circle ~48px
- Filled circles: primary color with animated checkmark/stamp icon
- Unfilled circles: dashed border, muted
- Below the grid: "5/10 stamps — 5 more for Free Coffee"
- Claim button appears when threshold reached (animated pulse)

**Vouchers tab:**
- List of active discount codes (from `discount_codes` table)
- Each voucher as a card: reward name, code (monospace), copy button
- Empty state if no vouchers

### 3. Wire into Index.tsx
- Add `if (activeTab === "loyalty")` block returning `<LoyaltyReadyFlow onBack={() => setActiveTab("home")} />`
- Remove the inline `<PatronLoyaltyCard compact />` from the home tab (replaced by the dedicated tab)

### 4. Update i18n
- Add `nav.loyalty` key and loyalty-specific strings to `en.json`
- Sync all 24 language files

### Files Changed

| File | Change |
|---|---|
| `src/components/TabNavigation.tsx` | Add 5th "Loyalty" tab |
| `src/components/LoyaltyReadyFlow.tsx` | **New** — hub + stamp page + vouchers |
| `src/pages/Index.tsx` | Add loyalty tab routing, remove inline PatronLoyaltyCard |
| `src/i18n/en.json` + 24 others | Add nav.loyalty and stamp page strings |

### Design Details
- Stamp circles use framer-motion `scale` + `fill` animations when earned
- Filled stamps get a subtle glow effect (box-shadow with primary color)
- Hub uses a 3-column grid of circular logos with venue names
- Voucher cards use the existing glass-morphism card style
- "Claim" button triggers the existing `claim-loyalty-reward` edge function
- Only stamp_card programs shown (points programs filtered out per user request)

