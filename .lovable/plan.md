

# Fix Scan Patron: Link Error + Add "Create Order for Patron" Option

## Problems
1. Clicking "Scan Patron" from the header toolbar sets `orderId=""`. The dialog then tries to update an order with `id=""`, which fails silently or errors.
2. After scanning a patron, there's no option to create a new order linked to them — only to link to an existing order.

## Solution

### `src/components/merchant/LinkPatronDialog.tsx`
Rework the dialog to handle two modes:

**Mode A — Link to existing order** (when `orderId` is provided): Current behavior, works fine.

**Mode B — No order pre-selected** (when `orderId` is empty): After finding the patron, show two action buttons:
- **"Create Order for Patron"** — Opens an inline form (order number + optional items/notes), then inserts a new order with `user_id` and `customer_name` pre-filled
- **"Link to Existing Order"** — Shows a dropdown/list of recent unlinked orders (where `user_id IS NULL`) for the venue, allowing the merchant to pick one

### Props change
Add `venueId` prop to `LinkPatronDialog` so it can create orders and query unlinked orders.

### `src/components/merchant/KitchenBoard.tsx`
- Pass `venueId` to the `LinkPatronDialog` component

### Technical details

**New order creation flow** (inside LinkPatronDialog):
```typescript
// Insert new order with patron pre-linked
const { error } = await supabase.from("orders").insert({
  venue_id: venueId,
  order_number: newOrderNumber,
  user_id: foundPatron.id,
  customer_name: foundPatron.full_name,
  status: "placed",
  items: [],
});
```

**Unlinked orders list** (when choosing to link existing):
```typescript
const { data } = await supabase
  .from("orders")
  .select("id, order_number, created_at")
  .eq("venue_id", venueId)
  .is("user_id", null)
  .in("status", ["placed", "in_prep"])
  .order("created_at", { ascending: false })
  .limit(10);
```

The dialog title dynamically changes based on mode:
- With orderId: "Link Patron to Order #XYZ"
- Without orderId: "Scan Patron"

After patron is found and action is completed, `onLinked()` is called to refresh the orders list.

