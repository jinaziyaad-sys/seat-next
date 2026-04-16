

# Add Patron ID to Bottom Navigation Bar

## What changes
Replace the "Profile" tab (User icon) in the bottom navigation with a "My ID" tab (QrCode icon) that navigates to the PatronIDCard view. The profile will still be accessible — it becomes one of the existing tabs or is reached via the ID card's expanded view.

**Wait — the user likely wants to _add_ the ID icon, not replace Profile.** Given there are already 6 tabs which is quite dense, I'll add a dedicated "My ID" tab using the QrCode icon. But 7 tabs would be too crowded.

**Better approach**: Replace the current 6th tab (Profile/User icon) with a QrCode icon labeled "My ID" that opens the PatronIDCard compact view as a sheet/popover from the bottom bar, or make it a new tab. Since the user said "move it to the bottom bar," the simplest approach is to add a QrCode icon button to the tab bar that triggers the PatronIDCard expand behavior inline.

### Plan

1. **`src/components/TabNavigation.tsx`** — Add a `QrCode` icon button between the last two tabs (or at the end) that, when tapped, opens a bottom sheet with the PatronIDCard. This keeps the existing 6 tabs and adds the ID as a special action button in the nav bar. Alternatively, replace the "Profile" tab icon or add "My ID" as a 7th compact item.

2. **`src/pages/Index.tsx`** — Remove the `PatronIDCard` from the home tab content (where it was just moved) since it's now in the bottom bar.

### Technical details

- Add `QrCode` import from lucide-react to `TabNavigation.tsx`
- Add a special center or end button in the nav bar that opens a Sheet (from `@/components/ui/sheet`) containing `<PatronIDCard compact />` 
- The button will stand out slightly (e.g., primary-colored circle) to differentiate it from navigation tabs
- Pass `userId` to TabNavigation as a new prop
- Remove the PatronIDCard rendering block from the home tab in `Index.tsx`

