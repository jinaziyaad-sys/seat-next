import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Check, Loader2, Sparkles, Shield, X, ChefHat, Users, Calendar, Gift, BarChart3, LayoutGrid, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PlanFromDB {
  id: string;
  name: string;
  description: string | null;
  monthly_price: number;
  annual_price: number;
  included_features: string[];
  sort_order: number;
  stripe_monthly_price_id: string | null;
  stripe_annual_price_id: string | null;
}

const FEATURE_DETAILS: Record<string, { label: string; description: string; icon: any }> = {
  food_ordering: { label: 'Food Ready Notifications', description: 'Let customers order and get notified when their food is ready for collection. Includes order tracking and ETA estimates.', icon: ChefHat },
  waitlist: { label: 'Digital Waitlist', description: 'Replace paper waitlists with a digital queue. Customers join via QR code and get real-time position updates.', icon: Users },
  reservations: { label: 'Table Reservations', description: 'Accept and manage table bookings with automated reminders, calendar view, and conflict detection.', icon: Calendar },
  loyalty: { label: 'Loyalty Program', description: 'Build repeat visits with stamp cards, points, tier rewards, challenges, and referral programs.', icon: Gift },
  analytics: { label: 'Analytics & Reports', description: 'Track wait times, order trends, customer segments, staff performance, and export data for insights.', icon: BarChart3 },
  kitchen_board: { label: 'Kitchen Display Board', description: 'Real-time kitchen screen showing active orders, prep times, and priority queues for your team.', icon: LayoutGrid },
};

const ALL_FEATURES = ['food_ordering', 'waitlist', 'reservations', 'loyalty', 'analytics', 'kitchen_board'];

export default function MerchantSignup() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [plans, setPlans] = useState<PlanFromDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [isAnnual, setIsAnnual] = useState(false);
  const [paymentProvider, setPaymentProvider] = useState<'stripe' | 'payfast'>('stripe');
  const [user, setUser] = useState<any>(null);

  const [showRegister, setShowRegister] = useState(false);
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regName, setRegName] = useState('');
  const [regVenueName, setRegVenueName] = useState('');
  const [regLoading, setRegLoading] = useState(false);

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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegLoading(true);
    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: regEmail,
        password: regPassword,
        options: {
          data: { full_name: regName },
          emailRedirectTo: `${window.location.origin}/merchant/dashboard`,
        },
      });
      if (signUpError) throw signUpError;
      if (!signUpData.user) throw new Error('Registration failed');

      const { error: merchantError } = await supabase.functions.invoke('create-merchant', {
        body: { userId: signUpData.user.id, email: regEmail, fullName: regName, venueName: regVenueName },
      });
      if (merchantError) throw merchantError;

      setUser(signUpData.user);
      setShowRegister(false);
      toast({ title: 'Account Created!', description: 'You can now select a plan to get started.' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Registration Error', description: err.message || 'Failed to create account' });
    } finally {
      setRegLoading(false);
    }
  };

  const handleSelectPlan = async (plan: PlanFromDB) => {
    if (!user) {
      setShowRegister(true);
      return;
    }

    setCheckoutLoading(plan.id);
    try {
      if (paymentProvider === 'payfast') {
        const { data, error } = await supabase.functions.invoke('payfast-checkout', {
          body: {
            planId: plan.id,
            billingCycle: isAnnual ? 'annual' : 'monthly',
            returnUrl: `${window.location.origin}/merchant/dashboard`,
            cancelUrl: `${window.location.origin}/merchant/signup`,
          },
        });
        if (error) throw error;
        if (data?.paymentUrl && data?.formData) {
          // Create and submit a form to PayFast
          const form = document.createElement('form');
          form.method = 'POST';
          form.action = data.paymentUrl;
          Object.entries(data.formData as Record<string, string>).forEach(([k, v]) => {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = k;
            input.value = v;
            form.appendChild(input);
          });
          document.body.appendChild(form);
          form.submit();
        }
      } else {
        const priceId = isAnnual ? plan.stripe_annual_price_id : plan.stripe_monthly_price_id;
        if (!priceId) throw new Error('This plan has no Stripe price configured. Please contact support.');

        const { data, error } = await supabase.functions.invoke('create-checkout', {
          body: { priceIds: [priceId] },
        });
        if (error) throw error;
        if (data?.url) {
          window.open(data.url, '_blank');
        }
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Checkout Error', description: err.message || 'Failed to start checkout' });
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
        <Button variant="ghost" size="sm" onClick={() => navigate('/merchant/auth')} className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Sign In
        </Button>

        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight mb-3">Everything You Need to Run Your Venue</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            ReadyUp replaces paper waitlists, manual order tracking, and scattered loyalty programs with one seamless platform your customers will love.
          </p>
          <div className="flex items-center justify-center gap-3 mt-8">
            <Label className={!isAnnual ? 'font-semibold' : 'text-muted-foreground'}>Monthly</Label>
            <Switch checked={isAnnual} onCheckedChange={setIsAnnual} />
            <Label className={isAnnual ? 'font-semibold' : 'text-muted-foreground'}>
              Annual
              <Badge variant="secondary" className="ml-2 text-xs">Save 17%</Badge>
            </Label>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            🧪 Test mode — Use card <code className="bg-muted px-1 rounded">4242 4242 4242 4242</code> with any future expiry and CVC.
          </p>
          <div className="flex items-center justify-center gap-3 mt-4">
            <Label className={paymentProvider === 'stripe' ? 'font-semibold' : 'text-muted-foreground'}>💳 Stripe</Label>
            <Switch checked={paymentProvider === 'payfast'} onCheckedChange={v => setPaymentProvider(v ? 'payfast' : 'stripe')} />
            <Label className={paymentProvider === 'payfast' ? 'font-semibold' : 'text-muted-foreground'}>🇿🇦 PayFast</Label>
          </div>
        </div>

        {showRegister && !user && (
          <Card className="max-w-md mx-auto mb-12">
            <CardHeader>
              <CardTitle>Create Your Merchant Account</CardTitle>
              <CardDescription>Set up your venue to get started</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <Label htmlFor="reg-name">Your Name</Label>
                  <Input id="reg-name" value={regName} onChange={e => setRegName(e.target.value)} required placeholder="John Smith" />
                </div>
                <div>
                  <Label htmlFor="reg-venue">Venue / Restaurant Name</Label>
                  <Input id="reg-venue" value={regVenueName} onChange={e => setRegVenueName(e.target.value)} required placeholder="The Daily Grind" />
                </div>
                <div>
                  <Label htmlFor="reg-email">Email</Label>
                  <Input id="reg-email" type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} required placeholder="you@venue.com" />
                </div>
                <div>
                  <Label htmlFor="reg-password">Password</Label>
                  <Input id="reg-password" type="password" value={regPassword} onChange={e => setRegPassword(e.target.value)} required minLength={6} placeholder="Min 6 characters" />
                </div>
                <Button type="submit" className="w-full" disabled={regLoading}>
                  {regLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Create Account
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  Already have an account?{' '}
                  <button type="button" className="text-primary underline" onClick={() => { setShowRegister(false); navigate('/merchant/auth'); }}>Sign in</button>
                </p>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {plans.map((plan) => {
            const price = isAnnual ? plan.annual_price / 12 : plan.monthly_price;
            const isPro = plan.name === 'Pro';
            const includedFeatures = Array.isArray(plan.included_features) ? plan.included_features : [];
            const isLoading = checkoutLoading === plan.id;

            return (
              <Card key={plan.id} className={`relative flex flex-col ${isPro ? 'border-primary shadow-lg ring-2 ring-primary/20' : ''}`}>
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
                    {isAnnual && <p className="text-xs text-muted-foreground mt-1">Billed R{plan.annual_price.toFixed(0)}/year</p>}
                  </div>
                  <ul className="space-y-3">
                    {ALL_FEATURES.map((featureKey) => {
                      const included = includedFeatures.includes(featureKey);
                      const detail = FEATURE_DETAILS[featureKey];
                      if (!detail) return null;
                      return (
                        <li key={featureKey} className={`flex items-start gap-2 text-sm ${!included ? 'opacity-40' : ''}`}>
                          {included ? <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" /> : <X className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />}
                          <span className="font-medium">{detail.label}</span>
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button className="w-full" variant={isPro ? 'default' : 'outline'} onClick={() => handleSelectPlan(plan)} disabled={!!checkoutLoading}>
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : user ? 'Start 7-Day Free Trial' : 'Start Free Trial'}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        <div className="max-w-4xl mx-auto mb-16">
          <h2 className="text-2xl font-bold text-center mb-8">What's Included in Each Feature</h2>
          <div className="grid sm:grid-cols-2 gap-6">
            {ALL_FEATURES.map((featureKey) => {
              const detail = FEATURE_DETAILS[featureKey];
              if (!detail) return null;
              const Icon = detail.icon;
              const availableIn = plans
                .filter(p => Array.isArray(p.included_features) && p.included_features.includes(featureKey))
                .map(p => p.name);
              return (
                <Card key={featureKey} className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-primary/10"><Icon className="h-5 w-5 text-primary" /></div>
                    <div className="flex-1">
                      <h3 className="font-semibold mb-1">{detail.label}</h3>
                      <p className="text-sm text-muted-foreground mb-2">{detail.description}</p>
                      <div className="flex gap-1.5 flex-wrap">
                        {availableIn.map(name => <Badge key={name} variant="secondary" className="text-xs">{name}</Badge>)}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        <div className="text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
          <Shield className="h-4 w-4" />
          Secure payment powered by Stripe. Cancel anytime. 14-day money-back guarantee.
        </div>
      </div>
    </div>
  );
}
