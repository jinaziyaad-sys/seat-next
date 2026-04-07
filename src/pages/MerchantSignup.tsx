import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Check, Loader2, Sparkles, Shield, X, ChefHat, Users, Calendar, Gift, BarChart3, LayoutGrid, ArrowLeft, ArrowRight, Eye, Upload, MapPin, Phone, Store, Camera } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { LogoCropDialog } from '@/components/LogoCropDialog';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

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
  food_ordering: { label: 'Food Ready Notifications', description: 'Let customers order and get notified when their food is ready for collection.', icon: ChefHat },
  waitlist: { label: 'Digital Waitlist', description: 'Replace paper waitlists with a digital queue. Customers join via QR code.', icon: Users },
  reservations: { label: 'Table Reservations', description: 'Accept and manage table bookings with automated reminders.', icon: Calendar },
  loyalty: { label: 'Loyalty Program', description: 'Build repeat visits with stamp cards, points, tier rewards, and referrals.', icon: Gift },
  analytics: { label: 'Analytics & Reports', description: 'Track wait times, order trends, customer segments, and export data.', icon: BarChart3 },
  kitchen_board: { label: 'Kitchen Display Board', description: 'Real-time kitchen screen showing active orders and prep times.', icon: LayoutGrid },
};

const ALL_FEATURES = ['food_ordering', 'waitlist', 'reservations', 'loyalty', 'analytics', 'kitchen_board'];

const STEPS = ['Choose Plan', 'Create Account', 'Set Up Venue', 'Payment'];

export default function MerchantSignup() {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Wizard state
  const [step, setStep] = useState(0);
  const [plans, setPlans] = useState<PlanFromDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  // Step 1 — Plan selection
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [isAnnual, setIsAnnual] = useState(false);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);

  // Step 2 — Registration
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regName, setRegName] = useState('');
  const [regLoading, setRegLoading] = useState(false);

  // Step 3 — Venue setup
  const [venueName, setVenueName] = useState('');
  const [venuePhone, setVenuePhone] = useState('');
  const [venueAddress, setVenueAddress] = useState('');
  const [venueDisplayAddress, setVenueDisplayAddress] = useState('');
  const [serviceTypes, setServiceTypes] = useState<string[]>(['food_ready', 'table_ready']);
  const [venueLoading, setVenueLoading] = useState(false);
  const [venueId, setVenueId] = useState<string | null>(null);

  // Step 4 — Payment
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [paymentProvider, setPaymentProvider] = useState<'stripe' | 'payfast'>('stripe');

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
      if (data.user) {
        setUser(data.user);
      }
    };

    fetchPlans();
    checkUser();
  }, []);

  // Auto-recommend plan based on selected features
  const getRecommendedPlan = () => {
    if (selectedFeatures.length === 0) return null;
    // Find smallest plan that includes all selected features
    const sorted = [...plans].sort((a, b) => a.sort_order - b.sort_order);
    for (const plan of sorted) {
      const included = Array.isArray(plan.included_features) ? plan.included_features : [];
      if (selectedFeatures.every(f => included.includes(f))) {
        return plan.id;
      }
    }
    // If no plan covers all, recommend the biggest
    return sorted[sorted.length - 1]?.id || null;
  };

  const recommendedPlanId = getRecommendedPlan();

  // Step 2: Register
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

      setUser(signUpData.user);
      toast({ title: 'Account Created!', description: 'Now let\'s set up your venue.' });
      setStep(2);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Registration Error', description: err.message || 'Failed to create account' });
    } finally {
      setRegLoading(false);
    }
  };

  // Step 3: Create venue
  const handleCreateVenue = async (e: React.FormEvent) => {
    e.preventDefault();
    setVenueLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('self-register-merchant', {
        body: {
          venueName,
          phone: venuePhone,
          displayAddress: venueDisplayAddress || venueAddress,
          address: venueAddress,
          serviceTypes,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setVenueId(data.venueId);
      toast({ title: 'Venue Created!', description: 'Almost done — choose your payment.' });
      setStep(3);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Setup Error', description: err.message || 'Failed to create venue' });
    } finally {
      setVenueLoading(false);
    }
  };

  // Step 4: Checkout
  const handleCheckout = async () => {
    const plan = plans.find(p => p.id === selectedPlanId);
    if (!plan) return;

    setCheckoutLoading(true);
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
        if (!priceId) throw new Error('This plan has no Stripe price configured.');

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
      setCheckoutLoading(false);
    }
  };

  const toggleFeature = (f: string) => {
    setSelectedFeatures(prev =>
      prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]
    );
  };

  const toggleServiceType = (t: string) => {
    setServiceTypes(prev =>
      prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
    );
  };

  const selectedPlan = plans.find(p => p.id === selectedPlanId);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-5xl mx-auto px-4 py-8">
        {/* Back button */}
        <Button variant="ghost" size="sm" onClick={() => step === 0 ? navigate('/merchant/auth') : setStep(step - 1)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> {step === 0 ? 'Back to Sign In' : 'Back'}
        </Button>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between text-sm text-muted-foreground mb-2">
            {STEPS.map((s, i) => (
              <span key={s} className={i <= step ? 'text-foreground font-medium' : ''}>{s}</span>
            ))}
          </div>
          <Progress value={((step + 1) / STEPS.length) * 100} className="h-2" />
        </div>

        {/* ============ STEP 0: Plan Selection ============ */}
        {step === 0 && (
          <div>
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold tracking-tight mb-2">Everything You Need to Run Your Venue</h1>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Select the features you need, and we'll recommend the right plan.
              </p>
            </div>

            {/* Feature selector */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="text-lg">What do you need?</CardTitle>
                <CardDescription>Select the features important to your venue</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 gap-3">
                  {ALL_FEATURES.map(featureKey => {
                    const detail = FEATURE_DETAILS[featureKey];
                    if (!detail) return null;
                    const Icon = detail.icon;
                    const isSelected = selectedFeatures.includes(featureKey);
                    return (
                      <button
                        key={featureKey}
                        type="button"
                        onClick={() => toggleFeature(featureKey)}
                        className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
                          isSelected ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border hover:border-primary/40'
                        }`}
                      >
                        <div className={`p-1.5 rounded-md ${isSelected ? 'bg-primary/10' : 'bg-muted'}`}>
                          <Icon className={`h-4 w-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{detail.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{detail.description}</p>
                        </div>
                        {isSelected && <Check className="h-4 w-4 text-primary shrink-0 mt-1" />}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Billing toggle */}
            <div className="flex items-center justify-center gap-3 mb-6">
              <Label className={!isAnnual ? 'font-semibold' : 'text-muted-foreground'}>Monthly</Label>
              <Switch checked={isAnnual} onCheckedChange={setIsAnnual} />
              <Label className={isAnnual ? 'font-semibold' : 'text-muted-foreground'}>
                Annual <Badge variant="secondary" className="ml-1 text-xs">Save 17%</Badge>
              </Label>
            </div>

            {/* Plan cards */}
            <div className="grid md:grid-cols-3 gap-5 mb-8">
              {plans.map(plan => {
                const price = isAnnual ? plan.annual_price / 12 : plan.monthly_price;
                const includedFeatures = Array.isArray(plan.included_features) ? plan.included_features : [];
                const isRecommended = plan.id === recommendedPlanId;
                const isSelected = plan.id === selectedPlanId;

                return (
                  <Card
                    key={plan.id}
                    className={`relative flex flex-col cursor-pointer transition-all ${
                      isSelected ? 'border-primary ring-2 ring-primary/30 shadow-lg' : isRecommended ? 'border-primary/50 shadow-md' : ''
                    }`}
                    onClick={() => setSelectedPlanId(plan.id)}
                  >
                    {isRecommended && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge className="bg-primary text-primary-foreground px-3">
                          <Sparkles className="h-3 w-3 mr-1" /> Recommended
                        </Badge>
                      </div>
                    )}
                    <CardHeader className="text-center pb-2">
                      <CardTitle className="text-lg">{plan.name}</CardTitle>
                      <CardDescription className="text-xs">{plan.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1">
                      <div className="text-center mb-4">
                        <span className="text-3xl font-bold">R{price.toFixed(0)}</span>
                        <span className="text-muted-foreground text-sm">/mo</span>
                        {isAnnual && <p className="text-xs text-muted-foreground mt-1">Billed R{plan.annual_price.toFixed(0)}/year</p>}
                      </div>
                      <ul className="space-y-2">
                        {ALL_FEATURES.map(featureKey => {
                          const included = includedFeatures.includes(featureKey);
                          const detail = FEATURE_DETAILS[featureKey];
                          if (!detail) return null;
                          return (
                            <li key={featureKey} className={`flex items-center gap-2 text-xs ${!included ? 'opacity-35' : ''}`}>
                              {included ? <Check className="h-3.5 w-3.5 text-primary shrink-0" /> : <X className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                              <span>{detail.label}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </CardContent>
                    <CardFooter>
                      <div className={`w-full h-2 rounded-full ${isSelected ? 'bg-primary' : 'bg-muted'}`} />
                    </CardFooter>
                  </Card>
                );
              })}
            </div>

            <div className="flex justify-center">
              <Button
                size="lg"
                onClick={() => {
                  if (!selectedPlanId) {
                    toast({ variant: 'destructive', title: 'Select a Plan', description: 'Please choose a plan to continue.' });
                    return;
                  }
                  setStep(user ? 2 : 1);
                }}
                disabled={!selectedPlanId}
              >
                Get Started <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>

            <p className="text-xs text-center text-muted-foreground mt-4">
              🧪 Test mode — Use card <code className="bg-muted px-1 rounded">4242 4242 4242 4242</code> with any future expiry and CVC.
            </p>
          </div>
        )}

        {/* ============ STEP 1: Registration ============ */}
        {step === 1 && (
          <Card className="max-w-md mx-auto">
            <CardHeader className="text-center">
              <CardTitle>Create Your Account</CardTitle>
              <CardDescription>We'll set up your venue next</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <Label htmlFor="reg-name">Your Full Name</Label>
                  <Input id="reg-name" value={regName} onChange={e => setRegName(e.target.value)} required placeholder="John Smith" />
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
                  <button type="button" className="text-primary underline" onClick={() => navigate('/merchant/auth')}>Sign in</button>
                </p>
              </form>
            </CardContent>
          </Card>
        )}

        {/* ============ STEP 2: Venue Setup ============ */}
        {step === 2 && (
          <Card className="max-w-lg mx-auto">
            <CardHeader className="text-center">
              <Store className="h-8 w-8 mx-auto text-primary mb-2" />
              <CardTitle>Set Up Your Venue</CardTitle>
              <CardDescription>Tell us about your restaurant or business</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateVenue} className="space-y-4">
                <div>
                  <Label htmlFor="venue-name">Venue Name *</Label>
                  <Input id="venue-name" value={venueName} onChange={e => setVenueName(e.target.value)} required placeholder="The Daily Grind" />
                </div>
                <div>
                  <Label htmlFor="venue-phone">Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="venue-phone" className="pl-10" value={venuePhone} onChange={e => setVenuePhone(e.target.value)} placeholder="+27 12 345 6789" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="venue-address">Address</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="venue-address" className="pl-10" value={venueAddress} onChange={e => setVenueAddress(e.target.value)} placeholder="123 Main St, Cape Town" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="venue-display-address">Display Address (shown to customers)</Label>
                  <Input id="venue-display-address" value={venueDisplayAddress} onChange={e => setVenueDisplayAddress(e.target.value)} placeholder="Corner of Main & Oak, Cape Town" />
                </div>

                <div>
                  <Label className="mb-2 block">Service Types</Label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={serviceTypes.includes('food_ready')}
                        onCheckedChange={() => toggleServiceType('food_ready')}
                      />
                      <span className="text-sm">🍔 Pickup / Food Ready</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={serviceTypes.includes('table_ready')}
                        onCheckedChange={() => toggleServiceType('table_ready')}
                      />
                      <span className="text-sm">🍽️ Dine-in / Table Ready</span>
                    </label>
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={venueLoading || serviceTypes.length === 0}>
                  {venueLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Create Venue & Continue
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* ============ STEP 3: Payment ============ */}
        {step === 3 && (
          <div className="max-w-md mx-auto">
            <Card>
              <CardHeader className="text-center">
                <CardTitle>Start Your Free Trial</CardTitle>
                <CardDescription>7-day free trial, cancel anytime</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedPlan && (
                  <div className="rounded-lg bg-muted p-4 text-center">
                    <p className="text-sm text-muted-foreground">Selected Plan</p>
                    <p className="text-xl font-bold">{selectedPlan.name}</p>
                    <p className="text-2xl font-bold mt-1">
                      R{(isAnnual ? selectedPlan.annual_price / 12 : selectedPlan.monthly_price).toFixed(0)}
                      <span className="text-sm font-normal text-muted-foreground">/mo</span>
                    </p>
                    {isAnnual && <p className="text-xs text-muted-foreground">Billed R{selectedPlan.annual_price.toFixed(0)}/year</p>}
                  </div>
                )}

                <div className="flex items-center justify-center gap-3">
                  <Label className={paymentProvider === 'stripe' ? 'font-semibold' : 'text-muted-foreground'}>💳 Stripe</Label>
                  <Switch checked={paymentProvider === 'payfast'} onCheckedChange={v => setPaymentProvider(v ? 'payfast' : 'stripe')} />
                  <Label className={paymentProvider === 'payfast' ? 'font-semibold' : 'text-muted-foreground'}>🇿🇦 PayFast</Label>
                </div>

                <Button className="w-full" size="lg" onClick={handleCheckout} disabled={checkoutLoading}>
                  {checkoutLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Start 7-Day Free Trial
                </Button>

                <Button variant="ghost" className="w-full text-sm" onClick={() => navigate('/merchant/dashboard')}>
                  Skip for now — set up later
                </Button>
              </CardContent>
            </Card>

            <div className="text-center text-sm text-muted-foreground flex items-center justify-center gap-2 mt-6">
              <Shield className="h-4 w-4" />
              Secure payment. Cancel anytime. 14-day money-back guarantee.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
