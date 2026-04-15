import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import {
  Clock, Bell, Utensils, Store, QrCode, Gift,
  ChevronRight, Instagram, Twitter, Facebook, Mail,
  Smartphone, Shield, Globe, ArrowRight
} from "lucide-react";
import logo from "@/assets/logo.png";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" }
  }),
};

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Navigation */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-lg">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <img src={logo} alt="ReadyUp" className="h-9 w-auto" />
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
            <a href="#how-it-works" className="text-muted-foreground hover:text-foreground transition-colors">How It Works</a>
            <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#about" className="text-muted-foreground hover:text-foreground transition-colors">About</a>
            <a href="#contact" className="text-muted-foreground hover:text-foreground transition-colors">Contact</a>
          </nav>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/auth")}>
              Log In
            </Button>
            <Button size="sm" onClick={() => navigate("/auth")}>
              Sign Up
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative py-24 md:py-36 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        <div className="container mx-auto px-4 relative">
          <div className="max-w-3xl mx-auto text-center">
            <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
              <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary mb-6">
                <Clock className="h-4 w-4" /> Now available
              </span>
            </motion.div>
            <motion.h1
              className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6"
              initial="hidden" animate="visible" variants={fadeUp} custom={1}
            >
              Skip the wait.{" "}
              <span className="text-primary">Know when you're ready.</span>
            </motion.h1>
            <motion.p
              className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto mb-10"
              initial="hidden" animate="visible" variants={fadeUp} custom={2}
            >
              Real-time order tracking, smart waitlists, and loyalty rewards — all in one app for diners and restaurants.
            </motion.p>
            <motion.div
              className="flex flex-col sm:flex-row gap-4 justify-center"
              initial="hidden" animate="visible" variants={fadeUp} custom={3}
            >
              <Button size="lg" className="text-base px-8 h-12" onClick={() => navigate("/auth")}>
                Get Started <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" className="text-base px-8 h-12" onClick={() => navigate("/merchant/auth")}>
                <Store className="mr-2 h-4 w-4" /> For Restaurants
              </Button>
            </motion.div>

            {/* App Store badges placeholder */}
            <motion.div
              className="flex justify-center gap-4 mt-8"
              initial="hidden" animate="visible" variants={fadeUp} custom={4}
            >
              <div className="flex items-center gap-2 rounded-lg border bg-card/60 px-4 py-2 text-sm text-muted-foreground">
                <Smartphone className="h-4 w-4" /> Coming soon to App Store & Google Play
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 md:py-28 bg-muted/30">
        <div className="container mx-auto px-4">
          <motion.div className="text-center mb-16" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-muted-foreground text-lg max-w-lg mx-auto">Three simple steps to a better dining experience</p>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              { step: "1", icon: QrCode, title: "Scan & Join", desc: "Scan the venue's QR code or search nearby to join the waitlist or place an order instantly." },
              { step: "2", icon: Bell, title: "Get Notified", desc: "Receive real-time updates on your table, food prep status, and estimated wait times." },
              { step: "3", icon: Utensils, title: "Enjoy", desc: "Walk in when your table is ready, collect your food on time — no more guessing." },
            ].map((item, i) => (
              <motion.div key={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i + 1}>
                <Card className="relative overflow-hidden border-0 bg-card/80 shadow-card h-full">
                  <div className="absolute top-4 right-4 text-6xl font-black text-primary/8">{item.step}</div>
                  <CardContent className="pt-8 pb-8 px-6">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5">
                      <item.icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">{item.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <motion.div className="text-center mb-16" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Everything You Need</h2>
            <p className="text-muted-foreground text-lg max-w-lg mx-auto">Powerful tools for diners and restaurants alike</p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              { icon: Clock, title: "Real-Time Tracking", desc: "Live order status and countdown timers so you always know where things stand." },
              { icon: Bell, title: "Smart Notifications", desc: "Push alerts when your table or food is ready — never miss the moment." },
              { icon: Gift, title: "Loyalty Rewards", desc: "Earn stamps and points at your favourite spots. Redeem for exclusive perks." },
              { icon: QrCode, title: "QR Check-In", desc: "Unique patron ID and QR code for seamless identification and order linking." },
              { icon: Shield, title: "Privacy First", desc: "Your data stays yours. POPIA-compliant with full data control." },
              { icon: Globe, title: "25+ Languages", desc: "Available in all 11 SA languages plus major global languages." },
            ].map((f, i) => (
              <motion.div key={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i * 0.5}>
                <div className="group p-6 rounded-xl border bg-card/60 hover:bg-card hover:shadow-card transition-all duration-300 h-full">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/15 transition-colors">
                    <f.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-1.5">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Merchant CTA */}
          <motion.div
            className="mt-16 max-w-2xl mx-auto text-center p-8 rounded-2xl bg-gradient-to-br from-primary/5 to-accent/5 border"
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}
          >
            <Store className="h-8 w-8 text-primary mx-auto mb-4" />
            <h3 className="text-2xl font-bold mb-2">Run a restaurant?</h3>
            <p className="text-muted-foreground mb-6">
              Manage waitlists, kitchen orders, table reservations, loyalty programs, and more from a single dashboard.
            </p>
            <Button onClick={() => navigate("/merchant/signup")} className="px-6">
              Start Free Trial <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </motion.div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="py-20 md:py-28 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">About ReadyUp</h2>
              <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                ReadyUp was born from a simple frustration — waiting without knowing. Whether it's standing at a busy restaurant 
                wondering when your table will be ready, or hovering at the counter unsure if your food is done, the uncertainty 
                ruins the experience.
              </p>
              <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                We're building a platform that connects diners and restaurants in real time, eliminating the guesswork from 
                dining out. From smart waitlists to live kitchen tracking, from loyalty rewards to instant communication — 
                ReadyUp puts you in control.
              </p>
              <p className="text-base text-muted-foreground">
                Built in South Africa 🇿🇦 for the world.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <motion.div className="text-center mb-12" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Get In Touch</h2>
            <p className="text-muted-foreground text-lg">We'd love to hear from you</p>
          </motion.div>
          <motion.div
            className="max-w-md mx-auto text-center space-y-6"
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={1}
          >
            <a
              href="mailto:hello@readyup.app"
              className="flex items-center justify-center gap-3 p-4 rounded-xl border bg-card/60 hover:bg-card hover:shadow-card transition-all text-foreground"
            >
              <Mail className="h-5 w-5 text-primary" />
              <span className="font-medium">hello@readyup.app</span>
            </a>

            <div className="flex justify-center gap-4 pt-4">
              {[
                { icon: Instagram, href: "https://instagram.com/readyupapp", label: "Instagram" },
                { icon: Twitter, href: "https://x.com/readyupapp", label: "X (Twitter)" },
                { icon: Facebook, href: "https://facebook.com/readyupapp", label: "Facebook" },
              ].map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  className="w-12 h-12 rounded-full border bg-card/60 hover:bg-primary/10 flex items-center justify-center transition-colors"
                >
                  <social.icon className="h-5 w-5 text-muted-foreground hover:text-primary" />
                </a>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-10 bg-muted/20">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <img src={logo} alt="ReadyUp" className="h-7 w-auto" />
              <span className="text-sm text-muted-foreground">© {new Date().getFullYear()} ReadyUp. All rights reserved.</span>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <button onClick={() => navigate("/privacy")} className="text-muted-foreground hover:text-foreground transition-colors">
                Privacy Policy
              </button>
              <button onClick={() => navigate("/auth")} className="text-muted-foreground hover:text-foreground transition-colors">
                Sign In
              </button>
              <button onClick={() => navigate("/merchant/auth")} className="text-muted-foreground hover:text-foreground transition-colors">
                Merchant Login
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
