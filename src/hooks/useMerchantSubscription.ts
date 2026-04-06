import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SubscriptionPlanConfig {
  id: string;
  name: string;
  stripe_product_id: string | null;
  stripe_annual_product_id: string | null;
  stripe_monthly_price_id: string | null;
  stripe_annual_price_id: string | null;
  monthly_price: number;
  annual_price: number;
}

// Cache for subscription plans loaded from DB
let cachedPlans: SubscriptionPlanConfig[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function loadSubscriptionPlans(): Promise<SubscriptionPlanConfig[]> {
  if (cachedPlans && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedPlans;
  }

  const { data, error } = await supabase
    .from('subscription_plans')
    .select('id, name, stripe_product_id, stripe_annual_product_id, stripe_monthly_price_id, stripe_annual_price_id, monthly_price, annual_price')
    .eq('is_active', true)
    .order('sort_order');

  if (error || !data) {
    console.error('Failed to load subscription plans:', error);
    return cachedPlans || [];
  }

  cachedPlans = data as SubscriptionPlanConfig[];
  cacheTimestamp = Date.now();
  return cachedPlans;
}

function getTierFromProducts(productIds: string[], plans: SubscriptionPlanConfig[]): string | null {
  for (const plan of plans) {
    const planProductIds = [plan.stripe_product_id, plan.stripe_annual_product_id].filter(Boolean);
    if (planProductIds.some(id => productIds.includes(id!))) {
      return plan.name;
    }
  }
  return null;
}

function getEntitledFeatures(productIds: string[], plans: SubscriptionPlanConfig[]): Set<string> {
  const features = new Set<string>();

  const isMatch = (planName: string) => {
    const plan = plans.find(p => p.name.toLowerCase() === planName.toLowerCase());
    if (!plan) return false;
    const ids = [plan.stripe_product_id, plan.stripe_annual_product_id].filter(Boolean);
    return ids.some(id => productIds.includes(id!));
  };

  const isStarter = isMatch('starter');
  const isPro = isMatch('pro');
  const isEnterprise = isMatch('enterprise');

  if (isStarter || isPro || isEnterprise) {
    features.add('food_ordering');
    features.add('waitlist');
    features.add('reservations');
    features.add('kitchen_board');
  }
  if (isPro || isEnterprise) {
    features.add('analytics');
  }
  if (isEnterprise) {
    features.add('loyalty');
  }

  return features;
}

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
  paymentProvider: string;
  hasFeature: (feature: string) => boolean;
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
  const [paymentProvider, setPaymentProvider] = useState('stripe');

  const checkSubscription = useCallback(async () => {
    try {
      const [{ data, error }, plans] = await Promise.all([
        supabase.functions.invoke('check-subscription', {
          body: venueId ? { venueId } : undefined,
        }),
        loadSubscriptionPlans(),
      ]);

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
        setTierName(getTierFromProducts(data.product_ids || [], plans));
        setEntitledFeatures(getEntitledFeatures(data.product_ids || [], plans));
        setPaymentProvider(data.payment_provider || 'stripe');
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
