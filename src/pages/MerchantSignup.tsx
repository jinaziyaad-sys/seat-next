import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Check, Loader2, Sparkles, Shield, X, ChefHat, Users, Calendar, Gift, BarChart3, LayoutGrid, ArrowLeft, ArrowRight, Eye, Upload, MapPin, Phone, Store, Camera, Search, MapPinned, Globe } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { LogoCropDialog } from '@/components/LogoCropDialog';
import { BannerCropDialog } from '@/components/BannerCropDialog';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { InteractiveLocationMap } from '@/components/InteractiveLocationMap';
import { SUPPORTED_CURRENCIES, CURRENCY_CODES, formatPrice, detectCurrency, convertFromZAR, FALLBACK_RATES } from '@/utils/currency';

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

const STEPS_FULL = ['Choose Plan', 'Create Account', 'Set Up Venue', 'Payment'];
const STEPS_UPGRADE = ['Choose Plan', 'Payment'];

export default function MerchantSignup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  // Upgrade mode detection
  const isUpgradeMode = searchParams.get('upgrade') === 'true';
  const upgradeVenueId = searchParams.get('venueId');
  const STEPS = isUpgradeMode ? STEPS_UPGRADE : STEPS_FULL;

  // Wizard state
  const [step, setStep] = useState(0);
  const [plans, setPlans] = useState<PlanFromDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  // Step 1 — Plan selection
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [isAnnual, setIsAnnual] = useState(false);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [selectedCurrency, setSelectedCurrency] = useState(() => detectCurrency());
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>(FALLBACK_RATES);
  const [currencyOverrides, setCurrencyOverrides] = useState<Record<string, { monthly: number; annual: number }>>({});
  const [ratesLoading, setRatesLoading] = useState(false);

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
  const [venueId, setVenueId] = useState<string | null>(upgradeVenueId || null);

  // Upgrade mode: current plan tracking
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);

  // Address validation & geolocation
  const [validatedAddress, setValidatedAddress] = useState<{
    formatted_address: string;
    latitude: number;
    longitude: number;
    precision: string;
  } | null>(null);
  const [addressValidating, setAddressValidating] = useState(false);
  const [showMap, setShowMap] = useState(false);

  // Logo state
  const [logoFile, setLogoFile] = useState<Blob | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoCropOpen, setLogoCropOpen] = useState(false);
  const [logoCropSrc, setLogoCropSrc] = useState('');
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Banner state
  const [bannerFile, setBannerFile] = useState<Blob | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [bannerCropOpen, setBannerCropOpen] = useState(false);
  const [bannerCropSrc, setBannerCropSrc] = useState('');
  const bannerInputRef = useRef<HTMLInputElement>(null);

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

    // In upgrade mode, load current subscription to badge the current plan
    const loadCurrentPlan = async () => {
      if (!isUpgradeMode || !upgradeVenueId) return;
      const { data } = await supabase
        .from('merchant_subscriptions')
        .select('plan_id')
        .eq('venue_id', upgradeVenueId)
        .in('status', ['active', 'trial'])
        .maybeSingle();
      if (data?.plan_id) {
        setCurrentPlanId(data.plan_id);
      }
    };

    const fetchRatesAndOverrides = async () => {
      setRatesLoading(true);
      try {
        // Fetch exchange rates
        const { data: rateData } = await supabase.functions.invoke('get-exchange-rates');
        if (rateData?.rates) setExchangeRates(rateData.rates);
      } catch { /* use fallback */ }

      try {
        // Fetch currency overrides
        const { data: overrides } = await supabase
          .from('plan_currency_overrides')
          .select('plan_id, currency, monthly_price, annual_price');
        if (overrides) {
          const map: Record<string, { monthly: number; annual: number }> = {};
          overrides.forEach((o: any) => {
            map[`${o.plan_id}_${o.currency}`] = { monthly: o.monthly_price, annual: o.annual_price };
          });
          setCurrencyOverrides(map);
        }
      } catch { /* ignore */ }
      setRatesLoading(false);
    };

    fetchPlans();
    checkUser();
    fetchRatesAndOverrides();
    if (isUpgradeMode) loadCurrentPlan();
  }, [isUpgradeMode, upgradeVenueId]);

  // Auto-recommend plan based on selected features
  const getRecommendedPlan = () => {
    if (selectedFeatures.length === 0) return null;
    const sorted = [...plans].sort((a, b) => a.sort_order - b.sort_order);
    for (const plan of sorted) {
      const included = Array.isArray(plan.included_features) ? plan.included_features : [];
      if (selectedFeatures.every(f => included.includes(f))) {
        return plan.id;
      }
    }
    return sorted[sorted.length - 1]?.id || null;
  };

  const recommendedPlanId = getRecommendedPlan();

  // Check if selected plan includes loyalty
  const selectedPlanIncludesLoyalty = () => {
    const plan = plans.find(p => p.id === selectedPlanId);
    if (!plan) return false;
    const included = Array.isArray(plan.included_features) ? plan.included_features : [];
    return included.includes('loyalty');
  };

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

  // Logo handlers
  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setLogoCropSrc(reader.result as string);
      setLogoCropOpen(true);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleLogoCropComplete = (blob: Blob) => {
    setLogoFile(blob);
    setLogoPreview(URL.createObjectURL(blob));
    setLogoCropOpen(false);
  };

  // Banner handlers
  const handleBannerSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setBannerCropSrc(reader.result as string);
      setBannerCropOpen(true);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleBannerCropComplete = (blob: Blob) => {
    setBannerFile(blob);
    setBannerPreview(URL.createObjectURL(blob));
    setBannerCropOpen(false);
  };

  // Address validation
  const handleValidateAddress = async () => {
    if (!venueAddress?.trim()) {
      toast({ variant: 'destructive', title: 'Address Required', description: 'Please enter an address to validate.' });
      return;
    }
    setAddressValidating(true);
    try {
      const { data, error } = await supabase.functions.invoke('validate-address', {
        body: { address: venueAddress },
      });
      if (error) throw error;
      if (!data?.valid) {
        toast({ variant: 'destructive', title: 'Invalid Address', description: data?.error || 'Address not found.' });
        return;
      }

      setValidatedAddress({
        formatted_address: data.formatted_address,
        latitude: data.latitude,
        longitude: data.longitude,
        precision: data.precision || 'area',
      });
      setShowMap(true);

      const precisionEmoji = data.precision === 'exact' ? '🎯' : data.precision === 'street' ? '📍' : '📌';
      const precisionLabel = data.precision === 'exact' ? 'Exact' : data.precision === 'street' ? 'Street Level' : 'Area Level';
      toast({
        title: `${precisionEmoji} Address Verified — ${precisionLabel}`,
        description: data.precision !== 'exact' ? 'You can adjust the pin on the map below.' : 'Location confirmed!',
      });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Validation Error', description: err.message || 'Failed to validate.' });
    } finally {
      setAddressValidating(false);
    }
  };

  // Step 3: Create venue
  const handleCreateVenue = async (e: React.FormEvent) => {
    e.preventDefault();

    // Require validated address if address was entered
    if (venueAddress?.trim() && !validatedAddress) {
      toast({ variant: 'destructive', title: 'Validate Address', description: 'Please validate your address before continuing.' });
      return;
    }

    setVenueLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('self-register-merchant', {
        body: {
          venueName,
          phone: venuePhone,
          displayAddress: venueDisplayAddress || venueAddress,
          address: validatedAddress?.formatted_address || venueAddress,
          latitude: validatedAddress?.latitude || null,
          longitude: validatedAddress?.longitude || null,
          serviceTypes,
          enableLoyalty: selectedPlanIncludesLoyalty(),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const newVenueId = data.venueId;
      setVenueId(newVenueId);

      // Upload logo if selected
      if (logoFile && newVenueId) {
        try {
          const logoPath = `${newVenueId}.png`;
          await supabase.storage.from('venue-logos').upload(logoPath, logoFile, {
            upsert: true,
            contentType: 'image/png',
          });
          const { data: urlData } = supabase.storage.from('venue-logos').getPublicUrl(logoPath);
          const logoUrl = `${urlData.publicUrl}?t=${Date.now()}`;
          await supabase.from('venues').update({ logo_url: logoUrl }).eq('id', newVenueId);
        } catch (logoErr) {
          console.error('Logo upload failed:', logoErr);
        }
      }

      // Upload banner if selected
      if (bannerFile && newVenueId) {
        try {
          const bannerPath = `${newVenueId}-banner.jpg`;
          await supabase.storage.from('venue-logos').upload(bannerPath, bannerFile, {
            upsert: true,
            contentType: 'image/jpeg',
          });
          const { data: urlData } = supabase.storage.from('venue-logos').getPublicUrl(bannerPath);
          const bannerUrl = `${urlData.publicUrl}?t=${Date.now()}`;
          await supabase.from('venues').update({ banner_url: bannerUrl } as any).eq('id', newVenueId);
        } catch (bannerErr) {
          console.error('Banner upload failed:', bannerErr);
        }
      }

      toast({ title: 'Venue Created!', description: 'Almost done — choose your payment.' });

      // Auto-detect payment provider based on venue address
      const addr = (validatedAddress?.formatted_address || venueAddress || '').toLowerCase();
      if (addr.includes('south africa') || addr.includes(', za') || addr.includes('cape town') || addr.includes('johannesburg') || addr.includes('durban') || addr.includes('pretoria')) {
        setPaymentProvider('payfast');
      } else {
        setPaymentProvider('stripe');
      }

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
            venueId,
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
          body: { priceIds: [priceId], venueId },
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
        <Button variant="ghost" size="sm" onClick={() => {
          if (step === 0) {
            navigate(isUpgradeMode ? '/merchant/dashboard' : '/merchant/auth');
          } else {
            // In upgrade mode step 1 = payment, go back to step 0 (plan selection)
            setStep(step - 1);
          }
        }} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> {step === 0 ? (isUpgradeMode ? 'Back to Dashboard' : 'Back to Sign In') : 'Back'}
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
              <h1 className="text-3xl font-bold tracking-tight mb-2">
                {isUpgradeMode ? 'Change Your Plan' : 'Everything You Need to Run Your Venue'}
              </h1>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                {isUpgradeMode 
                  ? 'Select a new plan below. Your current plan is highlighted.' 
                  : "Select the features you need, and we'll recommend the right plan."}
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
                const isCurrent = isUpgradeMode && plan.id === currentPlanId;

                return (
                  <Card
                    key={plan.id}
                    className={`relative flex flex-col transition-all ${
                      isCurrent ? 'opacity-60 cursor-not-allowed border-muted' :
                      isSelected ? 'border-primary ring-2 ring-primary/30 shadow-lg cursor-pointer' : 
                      isRecommended ? 'border-primary/50 shadow-md cursor-pointer' : 'cursor-pointer'
                    }`}
                    onClick={() => !isCurrent && setSelectedPlanId(plan.id)}
                  >
                    {isCurrent && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge variant="secondary" className="px-3">
                          Current Plan
                        </Badge>
                      </div>
                    )}
                    {isRecommended && !isCurrent && (
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
                  if (selectedPlanId === currentPlanId) {
                    toast({ variant: 'destructive', title: 'Same Plan', description: 'Please select a different plan to upgrade or downgrade.' });
                    return;
                  }
                  // In upgrade mode, skip registration & venue setup — go straight to payment
                  setStep(isUpgradeMode ? 1 : 1);
                }}
                disabled={!selectedPlanId || selectedPlanId === currentPlanId}
              >
                {isUpgradeMode ? 'Continue to Payment' : 'Get Started'} <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>

            <p className="text-xs text-center text-muted-foreground mt-4">
              🧪 Test mode — Use card <code className="bg-muted px-1 rounded">4242 4242 4242 4242</code> with any future expiry and CVC.
            </p>
          </div>
        )}

        {/* ============ STEP 1: Registration ============ */}
        {step === 1 && !isUpgradeMode && (
          <Card className="max-w-md mx-auto">
            <CardHeader className="text-center">
              <CardTitle>{user ? 'Account Ready' : 'Create Your Account'}</CardTitle>
              <CardDescription>{user ? 'You\'re signed in — let\'s set up your venue' : 'We\'ll set up your venue next'}</CardDescription>
            </CardHeader>
            <CardContent>
              {user ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-muted text-center">
                    <p className="text-sm text-muted-foreground mb-1">Signed in as</p>
                    <p className="font-medium">{user.email}</p>
                  </div>
                  <Button className="w-full" size="lg" onClick={() => setStep(2)}>
                    Continue to Venue Setup <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                  <p className="text-xs text-center text-muted-foreground">
                    Not you?{' '}
                    <button type="button" className="text-primary underline" onClick={async () => {
                      await supabase.auth.signOut();
                      setUser(null);
                    }}>Sign out</button>
                  </p>
                </div>
              ) : (
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
              )}
            </CardContent>
          </Card>
        )}

        {/* ============ STEP 2: Venue Setup ============ */}
        {step === 2 && !isUpgradeMode && (
          <Card className="max-w-2xl mx-auto">
            <CardHeader className="text-center">
              <Store className="h-8 w-8 mx-auto text-primary mb-2" />
              <CardTitle>Set Up Your Venue</CardTitle>
              <CardDescription>Tell us about your restaurant or business — you can update everything later in Settings</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateVenue} className="space-y-6">
                {/* Branding Row: Logo + Banner side by side */}
                <div className="grid sm:grid-cols-[auto_1fr] gap-6 items-start">
                  {/* Logo */}
                  <div className="flex flex-col items-center gap-2">
                    <Label className="text-sm text-muted-foreground">Logo</Label>
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      className="relative group"
                    >
                      <Avatar className="h-20 w-20 border-2 border-dashed border-muted-foreground/30 group-hover:border-primary transition-colors">
                        {logoPreview ? (
                          <AvatarImage src={logoPreview} alt="Logo preview" />
                        ) : null}
                        <AvatarFallback className="bg-muted">
                          <Camera className="h-6 w-6 text-muted-foreground" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Upload className="h-5 w-5 text-white" />
                      </div>
                    </button>
                    <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoSelect} />
                  </div>

                  {/* Banner */}
                  <div className="flex flex-col gap-2">
                    <Label className="text-sm text-muted-foreground">Banner Image (optional)</Label>
                    <button
                      type="button"
                      onClick={() => bannerInputRef.current?.click()}
                      className="relative group w-full h-24 rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary transition-colors overflow-hidden bg-muted flex items-center justify-center"
                    >
                      {bannerPreview ? (
                        <img src={bannerPreview} alt="Banner preview" className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-muted-foreground">
                          <Upload className="h-5 w-5" />
                          <span className="text-xs">16:9 recommended</span>
                        </div>
                      )}
                    </button>
                    <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={handleBannerSelect} />
                  </div>
                </div>

                {/* Basic Details */}
                <div className="grid sm:grid-cols-2 gap-4">
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
                </div>

                {/* Address with Validation */}
                <div className="space-y-3">
                  <Label>Venue Address</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        className="pl-10"
                        value={venueAddress}
                        onChange={e => {
                          setVenueAddress(e.target.value);
                          setValidatedAddress(null);
                          setShowMap(false);
                        }}
                        placeholder="123 Main St, Cape Town"
                      />
                    </div>
                    <Button
                      type="button"
                      variant={validatedAddress ? 'secondary' : 'outline'}
                      onClick={handleValidateAddress}
                      disabled={addressValidating || !venueAddress?.trim()}
                    >
                      {addressValidating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : validatedAddress ? (
                        <><Check className="h-4 w-4 mr-1" /> Verified</>
                      ) : (
                        <><Search className="h-4 w-4 mr-1" /> Verify</>
                      )}
                    </Button>
                  </div>

                  {validatedAddress && (
                    <div className="rounded-md bg-muted p-3 text-sm space-y-1">
                      <div className="flex items-center gap-2 text-foreground font-medium">
                        <MapPinned className="h-4 w-4 text-primary" />
                        {validatedAddress.formatted_address}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        GPS: {validatedAddress.latitude.toFixed(5)}, {validatedAddress.longitude.toFixed(5)} · {validatedAddress.precision} precision
                      </p>
                    </div>
                  )}

                  {showMap && validatedAddress && (
                    <div className="h-48 rounded-lg overflow-hidden border">
                      <InteractiveLocationMap
                        initialLatitude={validatedAddress.latitude}
                        initialLongitude={validatedAddress.longitude}
                        address={validatedAddress.formatted_address}
                        onLocationChange={(lat, lng) =>
                          setValidatedAddress(prev => prev ? { ...prev, latitude: lat, longitude: lng } : null)
                        }
                      />
                    </div>
                  )}
                </div>

                <div>
                  <Label htmlFor="venue-display-address">Display Address (shown to customers)</Label>
                  <Input id="venue-display-address" value={venueDisplayAddress} onChange={e => setVenueDisplayAddress(e.target.value)} placeholder="Corner of Main & Oak, Cape Town" />
                </div>

                {/* Service Types */}
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

                {/* Loyalty auto-activation note */}
                {selectedPlanIncludesLoyalty() && (
                  <div className="rounded-md bg-primary/5 border border-primary/20 p-3 flex items-start gap-3">
                    <Gift className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Loyalty Program Included</p>
                      <p className="text-xs text-muted-foreground">
                        A stamp card loyalty program will be automatically activated for your venue. You can customise rewards and settings in your dashboard.
                      </p>
                    </div>
                  </div>
                )}

                <Button type="submit" className="w-full" size="lg" disabled={venueLoading || serviceTypes.length === 0}>
                  {venueLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Create Venue & Continue
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* ============ STEP 3: Payment (or Step 1 in upgrade mode) ============ */}
        {(step === 3 || (isUpgradeMode && step === 1)) && (
          <div className="max-w-md mx-auto">
            <Card>
              <CardHeader className="text-center">
                <CardTitle>{isUpgradeMode ? 'Change Your Plan' : 'Start Your Free Trial'}</CardTitle>
                <CardDescription>{isUpgradeMode ? 'Proration is handled automatically by Stripe' : '7-day free trial, cancel anytime'}</CardDescription>
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
                  {isUpgradeMode ? 'Confirm Plan Change' : 'Start 7-Day Free Trial'}
                </Button>

                {!isUpgradeMode && (
                  <Button variant="ghost" className="w-full text-sm" onClick={() => navigate('/merchant/dashboard')}>
                    Skip for now — set up later
                  </Button>
                )}
                {isUpgradeMode && (
                  <Button variant="ghost" className="w-full text-sm" onClick={() => navigate('/merchant/dashboard')}>
                    Cancel
                  </Button>
                )}
              </CardContent>
            </Card>

            <div className="text-center text-sm text-muted-foreground flex items-center justify-center gap-2 mt-6">
              <Shield className="h-4 w-4" />
              Secure payment. Cancel anytime. 14-day money-back guarantee.
            </div>
          </div>
        )}

        {/* Crop Dialogs */}
        <LogoCropDialog
          open={logoCropOpen}
          imageSrc={logoCropSrc}
          onClose={() => setLogoCropOpen(false)}
          onCropComplete={handleLogoCropComplete}
        />
        <BannerCropDialog
          open={bannerCropOpen}
          imageSrc={bannerCropSrc}
          onClose={() => setBannerCropOpen(false)}
          onCropComplete={handleBannerCropComplete}
        />
      </div>
    </div>
  );
}
