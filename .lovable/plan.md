

# Remove Activity Tab from Bottom Navigation

Remove the "activity" tab entry from the `tabKeys` array in `src/components/TabNavigation.tsx` (line with `id: "activity"`). This reduces the bottom nav from 6 tabs + My ID to 5 tabs + My ID, giving more breathing room.

The Activity tab content in `Index.tsx` will remain accessible if needed later but won't have a nav entry.

**File**: `src/components/TabNavigation.tsx` — delete the activity entry from `tabKeys` array:
```typescript
{ id: "activity", labelKey: "nav.activity", icon: ClipboardList },
```

