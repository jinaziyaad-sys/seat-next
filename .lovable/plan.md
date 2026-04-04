

# Fix: Loyalty Tab Sitting on a Second Row

## Problem
The Loyalty tab overflows to a second row because `getTabCount()` returns 7 columns but there are actually 8 tabs rendered. The Floor Plan tab (rendered when `hasTableReady && admin`) is not counted.

Additionally, with 8+ tabs on smaller screens, even the correct count could cause cramped or wrapped tabs.

## Fix

**File: `src/pages/MerchantDashboard.tsx`**

Two changes:

1. **Fix `getTabCount`** — add Floor Plan to the count:
   ```typescript
   if (userRole?.role === "admin") {
     if (hasTableReady) count++; // Floor Plan tab
     count += 2; // Staff + Settings
     ...
   }
   ```

2. **Make the TabsList horizontally scrollable** — replace the rigid `grid` layout with `flex` + `overflow-x-auto` so all tabs sit in one row regardless of count, and scroll on smaller screens:
   ```tsx
   <TabsList className="flex w-full overflow-x-auto">
   ```
   This removes the grid approach entirely, letting tabs naturally sit side-by-side in a single row with equal sizing via `flex-1` on each trigger. This is more robust than counting columns and matches how tab bars typically work with many items.

### Technical Detail
- Remove `getTabCount()` function entirely
- Change `TabsList` from `grid` with inline `gridTemplateColumns` to `flex w-full overflow-x-auto`
- Add `flex-1 min-w-fit` to each `TabsTrigger` className so they share space equally but don't truncate

Single file change: `src/pages/MerchantDashboard.tsx`
