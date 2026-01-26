

# Enhanced Cancellation Acknowledge Flow

## Overview
Make the cancelled entry cards more visually prominent so merchants immediately notice and can dismiss them, rather than having cancelled entries quietly persist on the waitlist board.

## Current Behavior
- Cancelled entries show a "PATRON CANCELLED" badge and an "Acknowledge & Dismiss" button
- The button is styled as a standard outline button at the bottom of the card
- The card looks similar to other entries, making it easy to overlook

## New Behavior
- Cancelled entries will have a visually distinct card style (red/destructive border + background tint)
- The cancellation reason and dismiss button will be more prominent
- A pulsing alert icon will draw attention to unacknowledged cancellations
- Cards will be sorted to appear at the top of the list (after awaiting-confirmation entries)

---

## Technical Implementation

### 1. Add Visual Distinction to Cancelled Cards

Update the Card component wrapper (around line 1016) to apply distinct styling when the entry is cancelled:

```typescript
<Card 
  key={entry.id} 
  className={cn(
    "shadow-card",
    entry.status === "cancelled" && entry.cancelled_by === "patron" && 
      "border-2 border-destructive bg-destructive/5"
  )}
>
```

### 2. Update Sort Order to Prioritize Cancelled Entries

Modify the `sortedWaitlist` logic (lines 783-794) to show patron-cancelled entries near the top:

```typescript
const sortedWaitlist = [...waitlist].sort((a, b) => {
  // Highest priority: awaiting confirmation
  if (a.awaiting_merchant_confirmation && !b.awaiting_merchant_confirmation) return -1;
  if (b.awaiting_merchant_confirmation && !a.awaiting_merchant_confirmation) return 1;
  
  // Second priority: patron-cancelled (needs acknowledgment)
  const aPatronCancelled = a.status === "cancelled" && a.cancelled_by === "patron";
  const bPatronCancelled = b.status === "cancelled" && b.cancelled_by === "patron";
  if (aPatronCancelled && !bPatronCancelled) return -1;
  if (bPatronCancelled && !aPatronCancelled) return 1;
  
  // Third priority: ready status
  if (a.status === "ready" && b.status !== "ready") return -1;
  if (b.status === "ready" && a.status !== "ready") return 1;
  
  // Otherwise by creation time
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
});
```

### 3. Enhance the Cancellation Card Content

Update the cancelled entry section (lines 1064-1079) with:
- Larger alert icon header
- More prominent styling
- Clearer call-to-action button

```typescript
{entry.status === "cancelled" && entry.cancelled_by === "patron" && (
  <div className="space-y-3">
    <div className="flex items-center gap-2 text-destructive font-semibold">
      <AlertTriangle className="h-5 w-5" />
      <span>Patron Cancelled</span>
    </div>
    {entry.cancellation_reason && (
      <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/20">
        <p className="text-sm text-foreground">"{entry.cancellation_reason}"</p>
      </div>
    )}
    <Button
      onClick={() => acknowledgeCancellation(entry.id)}
      className="w-full bg-destructive hover:bg-destructive/90 text-white"
    >
      <Check className="h-4 w-4 mr-2" />
      Acknowledge & Dismiss
    </Button>
  </div>
)}
```

### 4. Add Import for New Icons

Add `AlertTriangle` and `Check` to the lucide-react import at the top of the file.

---

## File Changes Summary

**Modified File: `src/components/merchant/WaitlistBoard.tsx`**

| Location | Change |
|----------|--------|
| Line 11 | Add `AlertTriangle, Check` to lucide-react imports |
| Lines 783-794 | Update sort to prioritize patron-cancelled entries |
| Line 1016 | Add conditional destructive styling to cancelled cards |
| Lines 1064-1079 | Enhance cancellation UI with icons and prominent button |

---

## Visual Result

Before:
- Standard card with small badge and outline button

After:
- Red-bordered card with tinted background
- Alert icon header with "Patron Cancelled" text
- Destructive (red) primary button for dismiss action
- Sorted to top of list for visibility

