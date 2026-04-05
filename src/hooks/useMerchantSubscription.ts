import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Stripe product/price mapping
export const SUBSCRIPTION_TIERS: Record<string, {
  product_id: string;
  price_id: string;
  annual_product_id: string;
  annual_price_id: string;
  name: string;
}> = {
  starter: {
    product_id: 'prod_UHQvy6yev2Z4FJ',
    price_id: 'price_1TIs3WRrnmiHUS0LBQ9DkJlO',
    annual_product_id: 'prod_UHRVRONaVJns9q',
    annual_price_id: 'price_1TIscARrnmiHUS0LYvmnYFDl',
    name: 'Starter',
  },
  pro: {
    product_id: 'prod_UHQvBPLpLypA0e',
    price_id: 'price_1TIs3pRrnmiHUS0LaAn8xvUy',
    annual_product_id: 'prod_UHRVAz3q59g5Vm',
    annual_price_id: 'price_1TIscHRrnmiHUS0Lt8fOF8aP',
    name: 'Pro',
  },
  enterprise: {
    product_id: 'prod_UHQwZRXj29yoYZ',
    price_id: 'price_1TIs4JRrnmiHUS0LYSuWZptR',
    annual_product_id: 'prod_UHTdy0VRFEXVQe',
    annual_price_id: 'price_1TIufsRrnmiHUS0LTTWh2jVo',
    name: 'Enterprise',
  },
};

// All product IDs that map to each tier (monthly + annual)
export const TIER_PRODUCT_IDS: Record<string, string[]> = {
  starter: ['prod_UHQvy6yev2Z4FJ', 'prod_UHRVRONaVJns9q'],
  pro: ['prod_UHQvBPLpLypA0e', 'prod_UHRVAz3q59g5Vm'],
  enterprise: ['prod_UHQwZRXj29yoYZ', 'prod_UHTdy0VRFEXVQe'],
};

export interface SubscriptionState {
  loading: boolean;
  subscribed: boolean;
  status: 'none' | 'trial' | 'active' | 'past_due' | 'cancelled' | 'locked';
  tierName: string | null;
  productIds: string[];
  priceIds: string[];
  subscriptionEnd: string | null;
  trialEnd: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  hasFeature: (feature: string) => boolean;
}

function getTierFromProducts(productIds: string[]): string | null {
  for (const [tierKey, tierProductIds] of Object.entries(TIER_PRODUCT_IDS)) {
    if (tierProductIds.some(id => productIds.includes(id))) {
      return SUBSCRIPTION_TIERS[tierKey]?.name || tierKey;
    }
  }
  return null;
}

function getEntitledFeatures(productIds: string[]): Set<string> {
  const features = new Set<string>();
  const isStarter = TIER_PRODUCT_IDS.starter.some(id => productIds.includes(id));
  const isPro = TIER_PRODUCT_IDS.pro.some(id => productIds.includes(id));
  const isEnterprise = TIER_PRODUCT_IDS.enterprise.some(id => productIds.includes(id));

  // Starter: core features
  if (isStarter || isPro || isEnterprise) {
    features.add('food_ordering');
    features.add('waitlist');
    features.add('reservations');
    features.add('kitchen_board');
  }
  // Pro: + analytics
  if (isPro || isEnterprise) {
    features.add('analytics');
  }
  // Enterprise: + loyalty
  if (isEnterprise) {
    features.add('loyalty');
  }

  return features;
}

/**
 * Pass venueId to scope subscription check to a specific venue.
 * Without it, defaults to the user's first venue (legacy behavior).
 */
export function useMerchantSubscription(venueId?: string | null): SubscriptionState {
  const [loading, setLoading] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [status, setStatus] = useState<SubscriptionState['status']>('none');
  const [tierName, setTierName] = useState<string | null>(null);
  const [productIds, setProductIds] = useState<string[]>([]);
  const [priceIds, setPriceIds] = useState<string[]>([]);
  const [subscriptionEnd, setSubscriptionEnd] = useState<string | null>(null);
  const [trialEnd, setTrialEnd] = useState<string | null>(null);
  const [stripeCustomerId, setStripeCustomerId] = useState<string | null>(null);
  const [stripeSubscriptionId, setStripeSubscriptionId] = useState<string | null>(null);
  const [entitledFeatures, setEntitledFeatures] = useState<Set<string>>(new Set());

  const checkSubscription = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('check-subscription', {
        body: venueId ? { venueId } : undefined,
      });
      if (error) {
        console.error('Error checking subscription:', error);
        setLoading(false);
        return;
      }

      if (data.subscribed) {
        setSubscribed(true);
        setStatus(data.status || 'active');
        setProductIds(data.product_ids || []);
        setPriceIds(data.price_ids || []);
        setSubscriptionEnd(data.subscription_end);
        setTrialEnd(data.trial_end || null);
        setStripeCustomerId(data.stripe_customer_id);
        setStripeSubscriptionId(data.stripe_subscription_id);
        setTierName(getTierFromProducts(data.product_ids || []));
        setEntitledFeatures(getEntitledFeatures(data.product_ids || []));
      } else {
        setSubscribed(false);
        setStatus(data.status === 'past_due' ? 'past_due' : 'none');
        setProductIds([]);
        setPriceIds([]);
        setSubscriptionEnd(null);
        setTrialEnd(null);
        setTierName(null);
        setEntitledFeatures(new Set());
      }
    } catch (err) {
      console.error('Error checking subscription:', err);
    } finally {
      setLoading(false);
    }
  }, [venueId]);

  useEffect(() => {
    checkSubscription();
    const interval = setInterval(checkSubscription, 60000);
    return () => clearInterval(interval);
  }, [checkSubscription]);

  const hasFeature = useCallback((feature: string) => {
    return entitledFeatures.has(feature);
  }, [entitledFeatures]);

  return {
    loading,
    subscribed,
    status,
    tierName,
    productIds,
    priceIds,
    subscriptionEnd,
    trialEnd,
    stripeCustomerId,
    stripeSubscriptionId,
    hasFeature,
  };
}
