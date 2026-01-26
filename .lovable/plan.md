
# Per-Venue Export with Date Range for Dev Dashboard

## Overview
Create a new dedicated export component for the Dev Dashboard that allows super admins to:
1. Select a specific venue (or all venues) to export
2. Choose a date range for the export
3. Download comprehensive analytics data in a manageable Excel workbook

This replaces the current "Export All Venues" button which creates an unnecessarily large workbook and lacks date filtering.

---

## Current Issues
- `handleExportAllVenues` iterates through every venue and fetches all historical data without date limits
- Creates a single massive Excel file with potentially hundreds of sheets
- No date range filtering on the queries (unlike the merchant-side `MerchantExport` component)
- Risk of hitting Supabase's 1000-row query limit without pagination

---

## Implementation Plan

### 1. Create New DevExport Component
**File**: `src/components/dev/DevExport.tsx`

A new component that provides:
- Venue selector dropdown (with "All Venues" option)
- DateRangePicker for filtering data
- Export button that generates venue-specific workbooks

```text
+-----------------------------------------------+
|  Export Platform Data                         |
|-----------------------------------------------|
|  Venue: [▼ Select Venue / All Venues     ]    |
|                                               |
|  Date Range: [DateRangePicker]                |
|                                               |
|  [Export to Excel]   [Export to CSV]          |
+-----------------------------------------------+
```

### 2. Export Logic Per Venue
When a specific venue is selected:
- Create a single workbook with sheets for:
  - Orders (filtered by date)
  - Order Analytics (filtered by date)
  - Waitlist Entries (filtered by date)
  - Waitlist Analytics (filtered by date)
  - Ratings (filtered by date)
  - Daily Snapshots (filtered by date)
  - Customer Insights summary
  - Staff list
- Filename: `{VenueName}_{StartDate}_to_{EndDate}.xlsx`

### 3. Export Logic for All Venues
When "All Venues" is selected:
- Create one workbook with a summary sheet
- Include aggregated platform metrics (not per-venue sheets)
- Optionally, create a ZIP file containing individual venue workbooks to avoid massive single files

### 4. Update DevDashboard
- Remove/replace the current inline `handleExportAllVenues` function
- Add the new `DevExport` component to the "Manage Venues" tab or create a dedicated "Export" section

---

## Technical Details

### DevExport Component Structure
```typescript
interface DevExportProps {}

export function DevExport() {
  // State
  const [selectedVenueId, setSelectedVenueId] = useState<string | 'all'>('all');
  const [venues, setVenues] = useState<Venue[]>([]);
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [exporting, setExporting] = useState(false);

  // Fetch venues on mount
  useEffect(() => { fetchVenues(); }, []);

  // Export handler with date filtering
  const handleExport = async () => {
    if (selectedVenueId === 'all') {
      await exportPlatformSummary();
    } else {
      await exportSingleVenue(selectedVenueId);
    }
  };
}
```

### Query Patterns with Date Filtering
All queries will use `.gte()` and `.lte()` filters:
```typescript
const { data: orders } = await supabase
  .from('orders')
  .select('*')
  .eq('venue_id', venueId)
  .gte('created_at', startDate.toISOString())
  .lte('created_at', endDate.toISOString())
  .order('created_at', { ascending: false });
```

### Excel Sheet Contents for Single Venue Export

| Sheet Name | Data Source | Columns |
|------------|-------------|---------|
| Summary | Aggregated | Venue Name, Date Range, Total Orders, Total Waitlist, Avg Rating |
| Orders | orders table | Order Number, Customer, Status, Items, ETA, Created |
| Order Analytics | order_analytics | Placed At, Quoted Prep, Actual Prep, Items Count |
| Waitlist | waitlist_entries | Customer, Party Size, Status, ETA, Created |
| Waitlist Analytics | waitlist_analytics | Joined At, Party Size, Quoted Wait, Actual Wait, No Show |
| Ratings | order_ratings | Rating, Feedback, Type, Created |
| Daily Snapshots | daily_venue_snapshots | Date, Orders, Customers, Rating, Prep Time |
| Staff | user_roles + profiles | Name, Email, Role |

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/components/dev/DevExport.tsx` | Create | New export component with venue selector and date picker |
| `src/pages/DevDashboard.tsx` | Modify | Replace inline export with DevExport component, remove handleExportAllVenues |

---

## Benefits
- **Smaller file sizes**: Export only what you need
- **Date filtering**: Analyze specific periods
- **Better UX**: Choose exactly which venue to export
- **Performance**: Reduced query load on the database
- **Maintainability**: Reusable component pattern matching MerchantExport
