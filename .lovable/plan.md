

# Fix: Add Bottom Navigation Bar to Patron App

## The Problem
The `TabNavigation` component (with all 5 tabs including Loyalty) exists in `src/components/TabNavigation.tsx` but is **never imported or rendered** anywhere. The home page uses inline cards to navigate, but there's no persistent bottom nav — so the Loyalty tab (and quick switching between tabs) is invisible.

## The Fix

### 1. Render TabNavigation in Index.tsx
- Import `TabNavigation` into `src/pages/Index.tsx`
- Add it at the bottom of the main `<main>` return block (the home view at line 606+)
- Also render it in the food-ready, table-ready, loyalty, and profile views so it persists across all tabs
- Pass `activeTab` and `setActiveTab` as props

### 2. Add bottom padding
- Add `pb-24` to the main content area so content isn't hidden behind the fixed bottom nav

### 3. Add Loyalty card to home grid (optional but recommended)
- Add a 3rd feature card in the quick-actions grid for "Loyalty" alongside Food Ready and Table Ready, so users can also discover it from the home screen

### Files Changed

| File | Change |
|---|---|
| `src/pages/Index.tsx` | Import and render `TabNavigation` in all tab views; add bottom padding; optionally add Loyalty feature card |

This is a small, surgical fix — the component is already built and working, it just needs to be placed in the layout.

