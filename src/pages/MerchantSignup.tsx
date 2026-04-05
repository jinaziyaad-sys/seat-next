import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Check, Loader2, Sparkles, Shield } from 'lucide-react';
import { SUBSCRIPTION_TIERS } from '@/hooks/useMerchantSubscription';
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

const FEATURE_LABELS: Record<string, string> = {
  food_ordering: 'Food Ready',
  waitlist: 'Table Ready (Waitlist)',
  reservations: 'Reservations',
  loyalty: 'Loyalty Program',
  analytics: 'Analytics & Reports',
  kitchen_board: 'Kitchen Board',
};

export default function MerchantSignup() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [plans, setPlans] = useState<PlanFromDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [isAnnual, setIsAnnual] = useState(false);
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

  const tierMap: Record<string, { product_id: string; price_id: string; name: string }> = {
    'Starter': SUBSCRIPTION_TIERS.starter,
    'Pro': SUBSCRIPTION_TIERS.pro,
    'Enterprise': SUBSCRIPTION_TIERS.enterprise,
  };

  const handleSelectPlan = async (plan: PlanFromDB) => {
    if (!user) {
      navigate('/merchant/auth');
      return;
    }

    setCheckoutLoading(plan.id);
    try {
      const tier = tierMap[plan.name];
      if (!tier) throw new Error('Invalid plan');

      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { priceIds: [tier.price_id] },
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
      setCheckoutLoading(null);
    }
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
            Power your venue with ReadyUp. Select the plan that fits your needs.
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

          {/* Test mode notice */}
          <p className="text-xs text-muted-foreground mt-4">
            🧪 Test mode — Use card <code className="bg-muted px-1 rounded">4242 4242 4242 4242</code> with any future expiry and CVC.
          </p>
        </div>

        {/* Plans grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {plans.map((plan) => {
            const price = isAnnual ? plan.annual_price / 12 : plan.monthly_price;
            const isPro = plan.name === 'Pro';
            const features = Array.isArray(plan.included_features) ? plan.included_features : [];
            const isLoading = checkoutLoading === plan.id;

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
                    {features.map((feature: string) => (
                      <li key={feature} className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary shrink-0" />
                        {FEATURE_LABELS[feature] || feature}
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    variant={isPro ? 'default' : 'outline'}
                    onClick={() => handleSelectPlan(plan)}
                    disabled={!!checkoutLoading}
                  >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Get Started'}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {/* Security note */}
        <div className="text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
          <Shield className="h-4 w-4" />
          Secure payment powered by Stripe. Cancel anytime.
        </div>
      </div>
    </div>
  );
}
