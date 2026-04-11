

## Plan: Merge Table Configuration and Floor Plan into One Card

Right now the Floor Plan tab shows two separate sections: a Table Configuration card (list of tables with edit/delete buttons) and a Floor Plan grid (same tables again, but with booking info). They duplicate the same table visuals.

### What changes

**Single unified card in `FloorPlan.tsx`** -- Remove the separate `TableConfigurationManager` component usage. Instead, render one card titled "Floor Plan" with:

- A header showing table/seat count badge, today's date, and an "Add Table" button
- A single grid of table cards where each card shows:
  - Table name + capacity (always)
  - Edit/Delete buttons (small icons in the corner of each card)
  - Booking info if a reservation exists for today (customer name, time, party size)
  - "Available" badge if no booking
- The empty state shows an "Add First Table" button (same dialog as before)

**No changes to `TableConfigurationManager.tsx`** -- it stays as dead code for now (or we can delete it). The add/edit dialog logic moves inline into `FloorPlan.tsx`.

**No backend changes** -- same query, same save logic, same allocation functions.

### Files

| File | Action |
|---|---|
| `src/components/merchant/FloorPlan.tsx` | Rewrite to merge config + grid into one unified card with inline edit/delete on each table tile |

