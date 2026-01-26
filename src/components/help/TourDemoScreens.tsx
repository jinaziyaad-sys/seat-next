import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { 
  ArrowLeft, Clock, CheckCircle, UtensilsCrossed, Users, 
  Search, MapPin, Calendar, Star, Package, Navigation,
  ChefHat, Bell, Settings, FileText, UserCog
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// PATRON DEMO SCREENS
// ============================================================================

export function PatronDemoVenueSelect() {
  return (
    <div className="space-y-6 p-6" data-tour="demo-venue-select">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" disabled>
          <ArrowLeft size={20} />
        </Button>
        <h1 className="text-2xl font-bold">Food Ready</h1>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Select Restaurant</CardTitle>
          <p className="text-sm text-muted-foreground">Search and select your restaurant</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative" data-tour="demo-venue-search">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input
              placeholder="Search restaurants..."
              defaultValue=""
              className="pl-10"
              readOnly
            />
          </div>

          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">3 restaurants found</div>
            <div className="space-y-2">
              {[
                { name: "The Gourmet Kitchen", address: "123 Main Street", distance: "0.3 km" },
                { name: "Bella Italia", address: "456 Oak Avenue", distance: "0.8 km" },
                { name: "Sushi Paradise", address: "789 Pine Road", distance: "1.2 km" },
              ].map((venue, i) => (
                <Card 
                  key={i}
                  className={cn(
                    "group cursor-pointer transition-colors",
                    i === 0 && "border-2 border-primary bg-primary/5"
                  )}
                  data-tour={i === 0 ? "demo-venue-card" : undefined}
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex flex-col gap-1 flex-1">
                        <span className="font-medium">{venue.name}</span>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <MapPin size={14} />
                          <span>{venue.address}</span>
                        </div>
                      </div>
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <Navigation size={12} />
                        {venue.distance}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function PatronDemoOrderEntry() {
  return (
    <div className="space-y-6 p-6" data-tour="demo-order-entry">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" disabled>
          <ArrowLeft size={20} />
        </Button>
        <h1 className="text-2xl font-bold">Enter Order Number</h1>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>The Gourmet Kitchen</CardTitle>
          <p className="text-muted-foreground">Enter your POS order number from your receipt</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="e.g. A123, 4567, XY89..."
            defaultValue="A42"
            className="text-center text-lg font-mono h-12"
            data-tour="demo-order-input"
            readOnly
          />
          <Button className="w-full h-12" data-tour="demo-track-button">
            Track My Order
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function PatronDemoOrderTracking() {
  return (
    <div className="space-y-6 p-6 pb-24" data-tour="demo-order-tracking">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" disabled>
          <ArrowLeft size={20} />
        </Button>
        <h1 className="text-2xl font-bold">Order #A42</h1>
      </div>

      <Card className="shadow-card">
        <CardContent className="p-8 text-center space-y-6">
          <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-warning text-white" data-tour="demo-order-status">
            <Clock size={24} />
            <span className="text-xl font-bold">In Preparation</span>
          </div>

          <div className="space-y-2" data-tour="demo-order-venue">
            <h2 className="text-2xl font-bold text-primary">The Gourmet Kitchen</h2>
            <p className="text-muted-foreground">123 Main Street</p>
          </div>

          <Progress value={60} className="h-3" data-tour="demo-order-progress" />

          <div className="flex items-center justify-center gap-2 text-lg" data-tour="demo-order-eta">
            <Clock size={20} />
            <span className="font-semibold">12 minutes • ETA 14:35</span>
          </div>

          <div className="pt-4 border-t space-y-3">
            <h4 className="font-semibold text-left">Order Items</h4>
            <div className="space-y-2 text-left" data-tour="demo-order-items">
              <div className="flex justify-between">
                <span>Classic Burger</span>
                <span className="text-muted-foreground">x1</span>
              </div>
              <div className="flex justify-between">
                <span>Loaded Fries</span>
                <span className="text-muted-foreground">x1</span>
              </div>
              <div className="flex justify-between">
                <span>Iced Tea</span>
                <span className="text-muted-foreground">x2</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function PatronDemoOrderReady() {
  return (
    <div className="space-y-6 p-6 pb-24" data-tour="demo-order-ready">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" disabled>
          <ArrowLeft size={20} />
        </Button>
        <h1 className="text-2xl font-bold">Order #A42</h1>
      </div>

      <Card className="shadow-card border-2 border-success animate-pulse">
        <CardContent className="p-8 text-center space-y-6">
          <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-success text-white" data-tour="demo-ready-status">
            <CheckCircle size={24} />
            <span className="text-xl font-bold">Ready for Pickup!</span>
          </div>

          <div className="text-6xl">🎉</div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-success">Your order is ready!</h2>
            <p className="text-muted-foreground">Head to the counter to collect your order</p>
          </div>

          <Button className="w-full h-14 text-lg bg-success hover:bg-success/90" data-tour="demo-collected-button">
            I've Collected My Order
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function PatronDemoWaitlistEntry() {
  return (
    <div className="space-y-6 p-6" data-tour="demo-waitlist-entry">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" disabled>
          <ArrowLeft size={20} />
        </Button>
        <h1 className="text-2xl font-bold">Join Waitlist</h1>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Party Details</CardTitle>
          <p className="text-muted-foreground">Enter your party information</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Your Name</label>
            <Input defaultValue="Alex" className="mt-1" data-tour="demo-party-name" readOnly />
          </div>
          
          <div data-tour="demo-party-size">
            <label className="text-sm font-medium">Party Size</label>
            <div className="flex gap-2 mt-2">
              {[1, 2, 3, 4, 5, 6].map((size) => (
                <Button
                  key={size}
                  variant={size === 4 ? "default" : "outline"}
                  size="sm"
                  className="w-10 h-10"
                >
                  {size}
                </Button>
              ))}
            </div>
          </div>

          <div data-tour="demo-seating-pref">
            <label className="text-sm font-medium">Seating Preference</label>
            <div className="grid grid-cols-3 gap-2 mt-2">
              <Button variant="outline" size="sm">Indoor</Button>
              <Button variant="default" size="sm">Outdoor</Button>
              <Button variant="outline" size="sm">No Pref</Button>
            </div>
          </div>

          <Button className="w-full h-12 mt-4" data-tour="demo-join-button">
            Join Waitlist
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function PatronDemoWaitlistStatus() {
  return (
    <div className="space-y-6 p-6 pb-24" data-tour="demo-waitlist-status">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" disabled>
          <ArrowLeft size={20} />
        </Button>
        <h1 className="text-2xl font-bold">Waitlist Status</h1>
      </div>

      <Card className="shadow-card">
        <CardContent className="p-8 text-center space-y-6">
          <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center" data-tour="demo-position-icon">
            <Clock className="w-10 h-10 text-primary" />
          </div>
          
          <div className="space-y-2" data-tour="demo-position">
            <h2 className="text-3xl font-bold text-primary">#3</h2>
            <p className="text-lg text-muted-foreground">in line</p>
          </div>

          <div className="flex items-center justify-center gap-2 text-lg" data-tour="demo-wait-eta">
            <Clock size={20} />
            <span className="font-semibold">~20 minutes</span>
          </div>

          <div className="p-4 bg-primary/5 rounded-lg border" data-tour="demo-party-info">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Party</span>
              <span className="font-medium">Alex • 4 guests</span>
            </div>
            <div className="flex justify-between text-sm mt-2">
              <span className="text-muted-foreground">Preference</span>
              <span className="font-medium">Outdoor seating</span>
            </div>
          </div>

          <Button variant="outline" className="w-full" data-tour="demo-leave-button">
            Leave Waitlist
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function PatronDemoTableReady() {
  return (
    <div className="space-y-6 p-6 pb-24" data-tour="demo-table-ready">
      <Card className="shadow-card border-2 border-success">
        <CardContent className="p-8 text-center space-y-6">
          <div className="text-6xl">🎉</div>
          
          <div className="space-y-2" data-tour="demo-table-ready-msg">
            <h2 className="text-2xl font-bold text-success">Your Table is Ready!</h2>
            <p className="text-muted-foreground">Please proceed to the host stand</p>
          </div>

          <div className="w-24 h-24 mx-auto relative" data-tour="demo-countdown">
            <svg className="w-24 h-24 transform -rotate-90">
              <circle cx="48" cy="48" r="44" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/20" />
              <circle cx="48" cy="48" r="44" fill="none" stroke="currentColor" strokeWidth="8" className="text-success" 
                strokeDasharray={276} strokeDashoffset={69} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl font-bold">4:32</span>
            </div>
          </div>

          <Button className="w-full h-14 text-lg bg-success hover:bg-success/90" data-tour="demo-here-button">
            I'm Here - Get Seated
          </Button>
          
          <Button variant="outline" className="w-full" data-tour="demo-more-time">
            I Need More Time
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// MERCHANT DEMO SCREENS
// ============================================================================

export function MerchantDemoKitchenOrders() {
  return (
    <div className="space-y-4 p-4" data-tour="demo-kitchen-orders">
      <h2 className="text-lg font-bold flex items-center gap-2">
        <ChefHat size={20} />
        Kitchen Orders
      </h2>
      
      {/* Awaiting Verification */}
      <div data-tour="demo-awaiting-verification">
        <h3 className="text-sm font-medium text-muted-foreground mb-2">Awaiting Verification (1)</h3>
        <Card className="border-2 border-orange-500 bg-orange-50 dark:bg-orange-950/30 animate-pulse">
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <span className="font-bold text-lg">#A42</span>
                <p className="text-sm text-muted-foreground">Classic Burger, Loaded Fries, Iced Tea x2</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="text-destructive border-destructive">Reject</Button>
                <Button size="sm" className="bg-success hover:bg-success/90">Accept</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* In Prep */}
      <div data-tour="demo-in-prep">
        <h3 className="text-sm font-medium text-muted-foreground mb-2">In Preparation (2)</h3>
        <div className="space-y-2">
          <Card className="border-warning">
            <CardContent className="p-4">
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-bold">#A38</span>
                  <p className="text-sm text-muted-foreground">Margherita Pizza</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">8 min left</Badge>
                  <Button size="sm">Mark Ready</Button>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-warning">
            <CardContent className="p-4">
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-bold">#A39</span>
                  <p className="text-sm text-muted-foreground">Caesar Salad, Soup of Day</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">3 min left</Badge>
                  <Button size="sm">Mark Ready</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Ready */}
      <div data-tour="demo-ready-orders">
        <h3 className="text-sm font-medium text-muted-foreground mb-2">Ready for Pickup (1)</h3>
        <Card className="border-2 border-success bg-success/10">
          <CardContent className="p-4">
            <div className="flex justify-between items-center">
              <div>
                <span className="font-bold text-success">#A35</span>
                <p className="text-sm text-muted-foreground">Grilled Salmon, Side Salad</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-success">Ready 2m ago</Badge>
                <Button size="sm" variant="outline">Collected</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function MerchantDemoWaitlist() {
  return (
    <div className="space-y-4 p-4" data-tour="demo-merchant-waitlist">
      <h2 className="text-lg font-bold flex items-center gap-2">
        <Users size={20} />
        Waitlist
      </h2>

      <div className="flex gap-2 mb-4">
        <Button size="sm" data-tour="demo-add-guest">+ Add Guest</Button>
      </div>

      {/* Waiting Parties */}
      <div data-tour="demo-waiting-parties">
        <h3 className="text-sm font-medium text-muted-foreground mb-2">Waiting (3)</h3>
        <div className="space-y-2">
          {[
            { name: "Alex", size: 4, wait: "15 min", position: 1 },
            { name: "Jordan", size: 2, wait: "22 min", position: 2 },
            { name: "Sam", size: 6, wait: "30 min", position: 3 },
          ].map((party, i) => (
            <Card key={i} className={i === 0 ? "border-primary" : ""}>
              <CardContent className="p-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                      {party.position}
                    </div>
                    <div>
                      <span className="font-medium">{party.name}</span>
                      <p className="text-sm text-muted-foreground">Party of {party.size} • {party.wait}</p>
                    </div>
                  </div>
                  <Button size="sm" variant={i === 0 ? "default" : "outline"}>
                    {i === 0 ? "Table Ready" : "Notify"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Ready to Seat */}
      <div data-tour="demo-ready-to-seat">
        <h3 className="text-sm font-medium text-muted-foreground mb-2">Ready to Seat (1)</h3>
        <Card className="border-2 border-success bg-success/10">
          <CardContent className="p-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-success/20 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-success" />
                </div>
                <div>
                  <span className="font-medium text-success">Taylor</span>
                  <p className="text-sm text-muted-foreground">Party of 3 • Confirmed arrival</p>
                </div>
              </div>
              <Button size="sm" className="bg-success hover:bg-success/90">Seat Now</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function MerchantDemoReservations() {
  return (
    <div className="space-y-4 p-4" data-tour="demo-reservations">
      <h2 className="text-lg font-bold flex items-center gap-2">
        <Calendar size={20} />
        Today's Reservations
      </h2>

      <div className="grid gap-2" data-tour="demo-reservation-list">
        {[
          { time: "12:00", name: "Johnson", size: 4, table: "T3", status: "confirmed" },
          { time: "13:30", name: "Williams", size: 2, table: "T1", status: "confirmed" },
          { time: "18:00", name: "Brown", size: 6, table: "T5+T6", status: "pending" },
          { time: "19:30", name: "Garcia", size: 4, table: "T4", status: "confirmed" },
        ].map((res, i) => (
          <Card key={i} className={res.status === "pending" ? "border-warning" : ""}>
            <CardContent className="p-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="text-lg font-bold text-primary">{res.time}</div>
                  <div>
                    <span className="font-medium">{res.name}</span>
                    <p className="text-sm text-muted-foreground">Party of {res.size} • {res.table}</p>
                  </div>
                </div>
                <Badge variant={res.status === "pending" ? "secondary" : "default"}>
                  {res.status}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function MerchantDemoSettings() {
  return (
    <div className="space-y-4 p-4" data-tour="demo-settings">
      <h2 className="text-lg font-bold flex items-center gap-2">
        <Settings size={20} />
        Venue Settings
      </h2>

      <div className="grid gap-4">
        <Card data-tour="demo-business-hours">
          <CardContent className="p-4">
            <h3 className="font-medium mb-2">Business Hours</h3>
            <div className="text-sm text-muted-foreground space-y-1">
              <div className="flex justify-between"><span>Mon-Fri</span><span>11:00 - 22:00</span></div>
              <div className="flex justify-between"><span>Sat-Sun</span><span>10:00 - 23:00</span></div>
            </div>
          </CardContent>
        </Card>

        <Card data-tour="demo-table-config">
          <CardContent className="p-4">
            <h3 className="font-medium mb-2">Table Configuration</h3>
            <div className="flex gap-2 flex-wrap">
              {["T1 (2)", "T2 (2)", "T3 (4)", "T4 (4)", "T5 (6)", "T6 (6)"].map((t, i) => (
                <Badge key={i} variant="secondary">{t}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card data-tour="demo-notifications">
          <CardContent className="p-4">
            <h3 className="font-medium mb-2">Notification Sounds</h3>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">New order alerts</span>
              <Badge variant="default">Enabled</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function MerchantDemoReports() {
  return (
    <div className="space-y-4 p-4" data-tour="demo-reports">
      <h2 className="text-lg font-bold flex items-center gap-2">
        <FileText size={20} />
        Reports & Analytics
      </h2>

      <div className="grid grid-cols-2 gap-4" data-tour="demo-stats">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-primary">42</div>
            <div className="text-sm text-muted-foreground">Orders Today</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-success">4.8</div>
            <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
              <Star size={14} className="fill-yellow-400 text-yellow-400" />
              Avg Rating
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold">12m</div>
            <div className="text-sm text-muted-foreground">Avg Prep Time</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold">18</div>
            <div className="text-sm text-muted-foreground">Guests Seated</div>
          </CardContent>
        </Card>
      </div>

      <Card data-tour="demo-export">
        <CardContent className="p-4">
          <div className="flex justify-between items-center">
            <span className="font-medium">Export Data</span>
            <Button size="sm" variant="outline">Download CSV</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function MerchantDemoStaff() {
  return (
    <div className="space-y-4 p-4" data-tour="demo-staff">
      <h2 className="text-lg font-bold flex items-center gap-2">
        <UserCog size={20} />
        Staff Management
      </h2>

      <Button size="sm" className="mb-2" data-tour="demo-add-staff">+ Add Staff Member</Button>

      <div className="space-y-2" data-tour="demo-staff-list">
        {[
          { name: "Maria Santos", email: "maria@venue.com", role: "Admin" },
          { name: "James Lee", email: "james@venue.com", role: "Staff" },
          { name: "Emma Wilson", email: "emma@venue.com", role: "Staff" },
        ].map((staff, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-medium">{staff.name}</span>
                  <p className="text-sm text-muted-foreground">{staff.email}</p>
                </div>
                <Badge variant={staff.role === "Admin" ? "default" : "secondary"}>
                  {staff.role}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
