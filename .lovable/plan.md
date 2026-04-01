

# Batch 2: Audit Log, System Health, A/B Testing + Remove Data Export

## What's changing

**Remove**: "Download My Data" button from patron DataPrivacySection (agree — it adds admin overhead with little value). Keep deletion requests and privacy policy only.

**Add three new Dev platform features:**

### 1. Platform Audit Log
- **New migration**: `platform_audit_log` table with columns: `id`, `actor_id`, `action` (text), `entity_type` (text), `entity_id` (uuid), `details` (jsonb), `created_at`
- RLS: super_admin only for SELECT; INSERT via security definer function so triggers can write
- **New DB function**: `log_audit_event(action, entity_type, entity_id, details)` — security definer, captures `auth.uid()` as actor
- **DB triggers** on key tables: `venues` (INSERT/UPDATE/DELETE), `user_roles` (INSERT/DELETE), `feature_flags` updates via `platform_config`, `loyalty_programs` (INSERT/UPDATE)
- **New component**: `src/components/dev/AuditLogPanel.tsx` — filterable table (by action type, entity type, date range) with pagination
- **Add tab** to DevDashboard: "Audit Log"

### 2. System Health Dashboard
- **New component**: `src/components/dev/SystemHealthDashboard.tsx`
- Queries existing tables (no new migration):
  - Active users: count profiles with recent `updated_at`
  - Error trend: group `platform_errors` by day for last 7 days
  - Venue activity: count venues with recent orders/waitlist entries
  - Order volume: today vs yesterday comparison
- Shows cards with key metrics + a simple error trend chart
- **Add tab** to DevDashboard: "System Health"

### 3. A/B Testing / Percentage Rollout
- **New migration**: Add `rollout_percentage` (integer, default 100) and `user_segments` (jsonb, default '[]') columns to `platform_config`
- **Update `usePlatformConfig`**: For feature flags, evaluate rollout percentage using a hash of user ID — if hash % 100 >= rollout_percentage, feature is off for that user
- **Update `FeatureFlagsPanel`**: Add a percentage slider next to each toggle, showing "100% = all users"

### 4. Remove Data Export from Patron UI
- **Edit `DataPrivacySection.tsx`**: Remove the `handleExportRequest` function and "Download My Data" button. Keep only the deletion request flow and privacy policy link.

## Files

| File | Change |
|------|--------|
| New migration SQL | `platform_audit_log` table + triggers + `log_audit_event` function; add `rollout_percentage`/`user_segments` to `platform_config` |
| `src/components/dev/AuditLogPanel.tsx` | New — audit log viewer with filters |
| `src/components/dev/SystemHealthDashboard.tsx` | New — platform health metrics |
| `src/components/dev/FeatureFlagsPanel.tsx` | Add rollout percentage slider |
| `src/hooks/usePlatformConfig.ts` | Add rollout percentage evaluation logic |
| `src/pages/DevDashboard.tsx` | Add Audit Log and System Health tabs |
| `src/components/DataPrivacySection.tsx` | Remove data export button/function |

