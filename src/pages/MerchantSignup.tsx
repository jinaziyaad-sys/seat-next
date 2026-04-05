import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Check, Loader2, Sparkles, Shield, BarChart3, Gift } from 'lucide-react';
import { SUBSCRIPTION_TIERS, SUBSCRIPTION_ADDONS } from '@/hooks/useMerchantSubscription';
import { useToast } from '@/hooks/use-toast';

interface PlanFromDB {
  id: string;
  name: string;
  description: string | null;
  monthly_price: number;
  annual_price: number;
  included_features: string[];
  sort_order: number;
}

const FEATURE_LABELS: Record<string, { label: string; icon: any }> = {
  food_ordering: { label: 'Food Ready', icon: Check },
  waitlist: { label: 'Table Ready (Waitlist)', icon: Check },
  reservations: { label: 'Reservations', icon: Check },
  loyalty: { label: 'Loyalty Program', icon: Gift },
  analytics: { label: 'Analytics & Reports', icon: BarChart3 },
  kitchen_board: { label: 'Kitchen Board', icon: Check },
};

export default function MerchantSignup() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [plans, setPlans] = useState<PlanFromDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [isAnnual, setIsAnnual] = useState(false);
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const fetchPlans = async () => {
      const { data } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      setPlans((data as any) || []);
      setLoading(false);
    };

    const checkUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
    };

    fetchPlans();
    checkUser();
  }, []);

  const tierMap: Record<string, (typeof SUBSCRIPTION_TIERS)[keyof typeof SUBSCRIPTION_TIERS]> = {
    'Starter': SUBSCRIPTION_TIERS.starter,
    'Pro': SUBSCRIPTION_TIERS.pro,
    'Enterprise': SUBSCRIPTION_TIERS.enterprise,
  };

  const handleSelectPlan = async (plan: PlanFromDB) => {
    if (!user) {
      navigate('/merchant/auth');
      return;
    }

    setCheckoutLoading(true);
    try {
      const tier = tierMap[plan.name];
      if (!tier) throw new Error('Invalid plan');

      const priceIds = [tier.price_id];
      
      // Add selected add-ons
      selectedAddons.forEach(addonKey => {
        const addon = SUBSCRIPTION_ADDONS[addonKey as keyof typeof SUBSCRIPTION_ADDONS];
        if (addon) priceIds.push(addon.price_id);
      });

      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { priceIds },
      });

      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Checkout Error',
        description: err.message || 'Failed to start checkout',
      });
    } finally {
      setCheckoutLoading(false);
    }
  };

  const toggleAddon = (key: string) => {
    setSelectedAddons(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-6xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight mb-3">
            Choose Your Plan
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Power your venue with ReadyUp. Select the plan that fits your needs and add features as you grow.
          </p>

          {/* Billing toggle */}
          <div className="flex items-center justify-center gap-3 mt-8">
            <Label className={!isAnnual ? 'font-semibold' : 'text-muted-foreground'}>Monthly</Label>
            <Switch checked={isAnnual} onCheckedChange={setIsAnnual} />
            <Label className={isAnnual ? 'font-semibold' : 'text-muted-foreground'}>
              Annual
              <Badge variant="secondary" className="ml-2 text-xs">Save 17%</Badge>
            </Label>
          </div>
        </div>

        {/* Plans grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {plans.map((plan, idx) => {
            const price = isAnnual ? plan.annual_price / 12 : plan.monthly_price;
            const isPro = plan.name === 'Pro';
            const features = Array.isArray(plan.included_features) ? plan.included_features : [];

            return (
              <Card
                key={plan.id}
                className={`relative flex flex-col ${isPro ? 'border-primary shadow-lg ring-2 ring-primary/20' : ''}`}
              >
                {isPro && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground px-3">
                      <Sparkles className="h-3 w-3 mr-1" /> Most Popular
                    </Badge>
                  </div>
                )}
                <CardHeader className="text-center pb-2">
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <div className="text-center mb-6">
                    <span className="text-4xl font-bold">R{price.toFixed(0)}</span>
                    <span className="text-muted-foreground">/mo</span>
                    {isAnnual && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Billed R{plan.annual_price.toFixed(0)}/year
                      </p>
                    )}
                  </div>

                  <ul className="space-y-3">
                    {features.map((feature: string) => {
                      const fl = FEATURE_LABELS[feature];
                      return (
                        <li key={feature} className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-primary shrink-0" />
                          {fl?.label || feature}
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    variant={isPro ? 'default' : 'outline'}
                    onClick={() => handleSelectPlan(plan)}
                    disabled={checkoutLoading}
                  >
                    {checkoutLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Get Started'}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {/* Add-ons section */}
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-6">Optional Add-ons</h2>
          <p className="text-center text-muted-foreground mb-6">
            Enhance your plan with powerful add-ons. Available with any tier.
          </p>

          <div className="grid sm:grid-cols-2 gap-4">
            {Object.entries(SUBSCRIPTION_ADDONS).map(([key, addon]) => {
              const isSelected = selectedAddons.includes(key);
              return (
                <Card
                  key={key}
                  className={`cursor-pointer transition-all ${isSelected ? 'border-primary ring-1 ring-primary/30' : ''}`}
                  onClick={() => toggleAddon(key)}
                >
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {key === 'loyalty' ? <Gift className="h-5 w-5 text-primary" /> : <BarChart3 className="h-5 w-5 text-primary" />}
                      <div>
                        <p className="font-medium">{addon.name}</p>
                        <p className="text-sm text-muted-foreground">R299/mo</p>
                      </div>
                    </div>
                    <Switch checked={isSelected} onCheckedChange={() => toggleAddon(key)} />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Security note */}
        <div className="text-center mt-12 text-sm text-muted-foreground flex items-center justify-center gap-2">
          <Shield className="h-4 w-4" />
          Secure payment powered by Stripe. Cancel anytime.
        </div>
      </div>
    </div>
  );
}
