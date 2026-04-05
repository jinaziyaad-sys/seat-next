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
};

// All product IDs that map to each tier (monthly + annual + legacy)
export const TIER_PRODUCT_IDS: Record<string, string[]> = {
  starter: ['prod_UHQvy6yev2Z4FJ', 'prod_UHRVRONaVJns9q'],
  pro: ['prod_UHQvBPLpLypA0e', 'prod_UHRVAz3q59g5Vm', 'prod_UHQwZRXj29yoYZ'], // includes legacy Enterprise
};

// Add-ons removed — features are tier-based only

export interface SubscriptionState {
  loading: boolean;
  subscribed: boolean;
  status: 'none' | 'trial' | 'active' | 'past_due' | 'cancelled' | 'locked';
  tierName: string | null;
  productIds: string[];
  priceIds: string[];
  subscriptionEnd: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  // Feature entitlements derived from subscription
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

  if (isStarter || isPro) {
    features.add('food_ordering');
    features.add('waitlist');
    features.add('reservations');
    features.add('kitchen_board');
  }
  if (isPro) {
    features.add('loyalty');
    features.add('analytics');
  }

  return features;
}

export function useMerchantSubscription(): SubscriptionState {
  const [loading, setLoading] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [status, setStatus] = useState<SubscriptionState['status']>('none');
  const [tierName, setTierName] = useState<string | null>(null);
  const [productIds, setProductIds] = useState<string[]>([]);
  const [priceIds, setPriceIds] = useState<string[]>([]);
  const [subscriptionEnd, setSubscriptionEnd] = useState<string | null>(null);
  const [stripeCustomerId, setStripeCustomerId] = useState<string | null>(null);
  const [stripeSubscriptionId, setStripeSubscriptionId] = useState<string | null>(null);
  const [entitledFeatures, setEntitledFeatures] = useState<Set<string>>(new Set());

  const checkSubscription = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('check-subscription');
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
        setTierName(null);
        setEntitledFeatures(new Set());
      }
    } catch (err) {
      console.error('Error checking subscription:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSubscription();
    // Auto-refresh every 60 seconds
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
    stripeCustomerId,
    stripeSubscriptionId,
    hasFeature,
  };
}
