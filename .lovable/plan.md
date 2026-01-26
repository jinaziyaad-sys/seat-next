
# Personalized Venue Discovery - AI-Curated Recommendations

## Overview
Implement an AI-powered venue discovery system that recommends restaurants to patrons based on their preferences (dietary requirements, cuisine preferences), venue attributes (halaal, veg options, cuisine type), and real-time data (busyness, wait times, ratings).

---

## Architecture

```text
+------------------------------------------+
|         Patron Profile Section           |
|  [Dietary Preferences Card]              |
|   - Halaal, Vegetarian, Vegan, etc.      |
|   - Cuisine preferences (multi-select)   |
+------------------------------------------+
              |
              v
+------------------------------------------+
|    AI Venue Discovery Edge Function      |
|  1. Fetch patron preferences             |
|  2. Query matching venues                |
|  3. AI ranks by: preference match,       |
|     busyness, ratings, wait time         |
|  4. Generate personalized reasons        |
+------------------------------------------+
              |
              v
+------------------------------------------+
|      Patron "Explore" Section            |
|  - "For You" recommendations             |
|  - Busyness indicators                   |
|  - Match score badges                    |
|  - Quick filters (halaal, veg, nearby)   |
+------------------------------------------+
```

---

## Implementation Plan

### Phase 1: Database & Schema Changes

**New Table: `patron_dining_preferences`**
Stores patron dietary and cuisine preferences for personalization.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | FK to profiles |
| dietary_requirements | text[] | halaal, vegetarian, vegan, kosher, gluten_free |
| cuisine_preferences | text[] | italian, asian, indian, american, etc. |
| avoid_ingredients | text[] | Optional allergens to avoid |
| max_wait_minutes | int | Preferred max wait time |
| created_at | timestamp | |
| updated_at | timestamp | |

**Venue Settings Extension**
Add new fields to the existing `venues.settings` JSON column:

```json
{
  // Existing settings...
  
  // NEW: Venue attributes for discovery
  "venue_attributes": {
    "cuisine_types": ["indian", "asian"],
    "dietary_certifications": {
      "halaal": true,
      "vegetarian_friendly": true,
      "vegan_options": false,
      "kosher": false,
      "gluten_free_options": true
    },
    "price_range": "moderate", // budget, moderate, upscale
    "ambiance": ["casual", "family_friendly"],
    "features": ["outdoor_seating", "private_dining", "live_music"]
  }
}
```

---

### Phase 2: Merchant Settings UI

**New Section in MerchantSettings.tsx: "Venue Profile for Discovery"**

Add a new collapsible card allowing venue admins to configure:

1. **Cuisine Types** (multi-select checkboxes)
   - Italian, Indian, Asian, American, Mediterranean, African, Mexican, etc.

2. **Dietary Certifications** (toggle switches)
   - Halaal certified
   - Vegetarian friendly
   - Vegan options available
   - Kosher
   - Gluten-free options

3. **Price Range** (radio buttons)
   - Budget, Moderate, Upscale

4. **Venue Features** (multi-select checkboxes)
   - Outdoor seating, Private dining, Live entertainment, Kid-friendly, etc.

---

### Phase 3: Patron Preferences UI

**New Component: `src/components/PatronDiningPreferences.tsx`**

Add to the Profile Section with:

1. **Dietary Requirements** (multi-select chips)
   - Halaal, Vegetarian, Vegan, Kosher, Gluten-Free

2. **Cuisine Preferences** (multi-select with search)
   - Pre-populated from venues in the system
   - "No preference" option

3. **Wait Time Preference** (slider)
   - "I prefer short waits" to "I don't mind waiting"

---

### Phase 4: AI Recommendation Engine

**New Edge Function: `supabase/functions/get-venue-recommendations/index.ts`**

```text
Input:
- user_id (optional - for personalized recommendations)
- location (lat/lng for proximity)
- filters (optional overrides)

Process:
1. Fetch patron preferences from patron_dining_preferences
2. Query all venues with their:
   - settings.venue_attributes
   - Current busyness (waitlist count)
   - Average ratings
   - Distance from user
3. Call Lovable AI to:
   - Score venues based on preference match
   - Rank by combination of: match score, busyness, rating, distance
   - Generate 1-line personalized recommendation reason
4. Return ranked list with scores and reasons

Output:
[
  {
    venue_id: "...",
    name: "Restaurant ABC",
    match_score: 92,
    busyness: "short",
    avg_rating: 4.5,
    wait_estimate: "5-10 min",
    distance_km: 1.2,
    ai_reason: "Great halaal options with short wait - matches your preferences perfectly!"
  }
]
```

---

### Phase 5: Explore Venues UI

**New Component: `src/components/ExploreVenues.tsx`**

Features:
- "For You" section with AI-curated recommendations (requires login)
- Quick filter chips: Halaal, Vegetarian, Nearby, Short Wait
- Venue cards showing:
  - Name, cuisine tags, distance
  - Busyness indicator (using existing PatronBusynessIndicator)
  - Match percentage badge (if logged in)
  - AI-generated recommendation snippet
- Pull-to-refresh for updated recommendations

**Integration into Index.tsx**
Add new "Explore" card alongside "Food Ready" and "Table Ready":

```text
+----------------+  +----------------+  +----------------+
|  Food Ready    |  |  Table Ready   |  |   Explore      |
|  Track orders  |  |  Join waitlist |  |  Find venues   |
+----------------+  +----------------+  +----------------+
```

---

## Technical Details

### Files to Create

| File | Purpose |
|------|---------|
| `src/components/PatronDiningPreferences.tsx` | Patron dietary/cuisine preference settings |
| `src/components/ExploreVenues.tsx` | Venue discovery UI with AI recommendations |
| `supabase/functions/get-venue-recommendations/index.ts` | AI recommendation engine |

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/merchant/MerchantSettings.tsx` | Add "Venue Profile" section for attributes |
| `src/components/ProfileSection.tsx` | Include PatronDiningPreferences component |
| `src/pages/Index.tsx` | Add "Explore" card and tab handling |

### Database Migration

```sql
-- Patron dining preferences table
CREATE TABLE patron_dining_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  dietary_requirements text[] DEFAULT '{}',
  cuisine_preferences text[] DEFAULT '{}',
  avoid_ingredients text[] DEFAULT '{}',
  max_wait_minutes int DEFAULT 30,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS policies
ALTER TABLE patron_dining_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own preferences" ON patron_dining_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences" ON patron_dining_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences" ON patron_dining_preferences
  FOR UPDATE USING (auth.uid() = user_id);
```

---

## AI Prompt Design

The AI recommendation engine will use structured tool calling to ensure consistent output:

```typescript
tools: [{
  type: "function",
  function: {
    name: "rank_venues",
    description: "Rank venues for a patron based on preferences",
    parameters: {
      type: "object",
      properties: {
        recommendations: {
          type: "array",
          items: {
            type: "object",
            properties: {
              venue_id: { type: "string" },
              match_score: { type: "number", description: "0-100" },
              reason: { type: "string", description: "1 sentence explanation" }
            }
          }
        }
      }
    }
  }
}]
```

---

## User Flow

### Patron Journey
1. Signs in and navigates to Profile
2. Sets dietary preferences (Halaal, Vegetarian)
3. Selects preferred cuisines (Indian, Italian)
4. Returns to home and taps "Explore"
5. Sees personalized recommendations with match scores
6. Filters by "Halaal" + "Short Wait"
7. Taps venue card to view details or join waitlist

### Merchant Journey
1. Admin navigates to Settings
2. Opens "Venue Profile for Discovery" section
3. Enables "Halaal Certified" and "Vegetarian Friendly"
4. Selects cuisine types: "Indian", "Pakistani"
5. Saves settings
6. Venue now appears in recommendations for matching patrons

---

## Benefits
- **Personalized experience**: AI matches patrons to venues based on dietary needs
- **Reduced friction**: Halaal-conscious users see certified venues first
- **Increased discoverability**: New venues with matching attributes get visibility
- **Real-time relevance**: Busyness and wait times factor into recommendations
- **Merchant control**: Venues self-describe their attributes
