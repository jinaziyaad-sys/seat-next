import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { motion, useScroll, useTransform } from "framer-motion";
import { Suspense, useRef } from "react";
import {
  Clock, Bell, Utensils, Store, QrCode, Gift,
  ChevronRight, Instagram, Twitter, Facebook, Mail,
  Smartphone, Shield, Globe, ArrowRight, Users, Zap, BarChart3
} from "lucide-react";
import logo from "@/assets/logo.png";
import { FloatingScene } from "@/components/landing/FloatingScene";
import { ScrollFork } from "@/components/landing/ScrollFork";
import { AnimatedText, HighlightText, ScrollReveal, CountUp } from "@/components/landing/AnimatedText";
import { ClientLogos } from "@/components/landing/ClientLogos";

export default function Landing() {
  const navigate = useNavigate();
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroOpacity = useTransform(scrollYProgress, [0, 1], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 0.92]);
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 100]);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Fixed scroll-driven fork overlay */}
      <ScrollFork />
      {/* Navigation */}
      <header className="fixed top-0 z-50 w-full border-b bg-background/60 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <motion.div
            className="flex items-center gap-2"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <img src={logo} alt="ReadyUp" className="h-9 w-auto" />
          </motion.div>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
            {["How It Works", "Features", "About", "Contact"].map((item, i) => (
              <motion.a
                key={item}
                href={`#${item.toLowerCase().replace(/\s+/g, "-")}`}
                className="text-muted-foreground hover:text-foreground transition-colors relative group"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * i, duration: 0.5 }}
              >
                {item}
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all duration-300 group-hover:w-full" />
              </motion.a>
            ))}
          </nav>
          <motion.div
            className="flex items-center gap-3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Button variant="ghost" size="sm" onClick={() => navigate("/auth")}>
              Log In
            </Button>
            <Button size="sm" className="shadow-lg shadow-primary/25" onClick={() => navigate("/auth")}>
              Sign Up
            </Button>
          </motion.div>
        </div>
      </header>

      {/* Hero */}
      <section ref={heroRef} className="relative min-h-screen flex items-center pt-16 overflow-hidden">
        {/* 3D Background */}
        <Suspense fallback={null}>
          <FloatingScene />
        </Suspense>

        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-transparent to-background pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent pointer-events-none" />

        <motion.div
          className="container mx-auto px-4 relative"
          style={{ opacity: heroOpacity, scale: heroScale, y: heroY }}
        >
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-5 py-2 text-sm font-medium text-primary mb-8 backdrop-blur-sm">
                <Zap className="h-4 w-4" /> Now available in South Africa
              </span>
            </motion.div>

            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.05] mb-8">
              <AnimatedText delay={0.2}>Skip the wait.</AnimatedText>
              <br />
              <span className="text-primary">
                <AnimatedText delay={0.6}>Know when you're ready.</AnimatedText>
              </span>
            </h1>

            <motion.p
              className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-12 leading-relaxed"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1, duration: 0.7 }}
            >
              Real-time order tracking, smart waitlists, and loyalty rewards — all in one
              beautifully designed app for <HighlightText>diners</HighlightText> and <HighlightText>restaurants</HighlightText>.
            </motion.p>

            <motion.div
              className="flex flex-col sm:flex-row gap-4 justify-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2, duration: 0.7 }}
            >
              <Button
                size="lg"
                className="text-base px-10 h-14 rounded-2xl shadow-xl shadow-primary/30 hover:shadow-primary/40 transition-all duration-300 hover:scale-105"
                onClick={() => navigate("/auth")}
              >
                Get Started Free <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-base px-10 h-14 rounded-2xl backdrop-blur-sm bg-background/60 hover:bg-background/80 transition-all duration-300 hover:scale-105"
                onClick={() => navigate("/merchant/auth")}
              >
                <Store className="mr-2 h-5 w-5" /> For Restaurants
              </Button>
            </motion.div>

            {/* App Store Coming Soon */}
            <motion.div
              className="flex justify-center gap-4 mt-10"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.5, duration: 0.7 }}
            >
              <div className="flex items-center gap-2 rounded-2xl border border-primary/10 bg-card/40 backdrop-blur-sm px-5 py-2.5 text-sm text-muted-foreground">
                <Smartphone className="h-4 w-4 text-primary" /> Coming soon to App Store & Google Play
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
        >
          <motion.div
            className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex justify-center pt-2"
            animate={{ y: [0, 5, 0] }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          >
            <div className="w-1 h-2 rounded-full bg-primary/60" />
          </motion.div>
        </motion.div>
      </section>

      {/* Stats Bar */}
      <section className="py-16 border-y bg-muted/20">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-3 gap-8 max-w-3xl mx-auto text-center">
            {[
              { value: 25, suffix: "+", label: "Languages" },
              { value: 0, suffix: "", label: "Hidden Fees", prefix: "R" },
              { value: 24, suffix: "/7", label: "Real-Time Updates" },
            ].map((stat, i) => (
              <ScrollReveal key={i} delay={i * 0.1}>
                <div>
                  <p className="text-3xl md:text-4xl font-bold text-primary">
                    {stat.prefix || ""}<CountUp target={stat.value} />{stat.suffix}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>


      {/* How It Works */}
      <section id="how-it-works" className="py-24 md:py-32">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <div className="text-center mb-20">
              <p className="text-sm font-medium uppercase tracking-widest text-primary mb-3">Simple & Seamless</p>
              <h2 className="text-3xl md:text-5xl font-bold">
                How It <HighlightText>Works</HighlightText>
              </h2>
            </div>
          </ScrollReveal>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto relative">
            {/* Connecting line */}
            <div className="hidden md:block absolute top-24 left-[20%] right-[20%] h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

            {[
              { step: "01", icon: QrCode, title: "Scan & Join", desc: "Scan the venue's QR code or search nearby to join the waitlist or place an order instantly.", color: "from-orange-500/20 to-amber-500/20" },
              { step: "02", icon: Bell, title: "Get Notified", desc: "Receive real-time updates on your table, food prep status, and estimated wait times.", color: "from-primary/20 to-orange-400/20" },
              { step: "03", icon: Utensils, title: "Enjoy", desc: "Walk in when your table is ready, collect your food on time — no more guessing.", color: "from-amber-400/20 to-yellow-500/20" },
            ].map((item, i) => (
              <ScrollReveal key={i} delay={i * 0.15} direction="up">
                <Card className="relative overflow-hidden border-0 bg-gradient-to-br shadow-xl hover:shadow-2xl transition-all duration-500 h-full group hover:-translate-y-2">
                  <div className={`absolute inset-0 bg-gradient-to-br ${item.color} opacity-60`} />
                  <div className="absolute -top-4 -right-4 text-[120px] font-black text-primary/5 leading-none select-none">
                    {item.step}
                  </div>
                  <CardContent className="relative pt-10 pb-10 px-8">
                    <motion.div
                      className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors duration-300"
                      whileHover={{ rotate: 5, scale: 1.05 }}
                    >
                      <item.icon className="h-8 w-8 text-primary" />
                    </motion.div>
                    <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">{item.desc}</p>
                  </CardContent>
                </Card>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 md:py-32 bg-muted/20">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <div className="text-center mb-20">
              <p className="text-sm font-medium uppercase tracking-widest text-primary mb-3">Powerful Features</p>
              <h2 className="text-3xl md:text-5xl font-bold">
                Everything You <HighlightText>Need</HighlightText>
              </h2>
              <p className="text-muted-foreground text-lg max-w-lg mx-auto mt-4">Powerful tools for diners and restaurants alike</p>
            </div>
          </ScrollReveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              { icon: Clock, title: "Real-Time Tracking", desc: "Live order status and countdown timers so you always know where things stand." },
              { icon: Bell, title: "Smart Notifications", desc: "Push alerts when your table or food is ready — never miss the moment." },
              { icon: Gift, title: "Loyalty Rewards", desc: "Earn stamps and points at your favourite spots. Redeem for exclusive perks." },
              { icon: QrCode, title: "QR Check-In", desc: "Unique patron ID and QR code for seamless identification and order linking." },
              { icon: Shield, title: "Privacy First", desc: "Your data stays yours. POPIA-compliant with full data control." },
              { icon: Globe, title: "25+ Languages", desc: "Available in all 11 SA languages plus major global languages." },
            ].map((f, i) => (
              <ScrollReveal key={i} delay={i * 0.08} direction={i % 2 === 0 ? "left" : "right"}>
                <motion.div
                  className="group p-7 rounded-2xl border bg-card/60 hover:bg-card hover:shadow-xl transition-all duration-500 h-full cursor-default"
                  whileHover={{ y: -4 }}
                >
                  <motion.div
                    className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300"
                    whileHover={{ rotate: 10 }}
                  >
                    <f.icon className="h-6 w-6 text-primary group-hover:text-primary-foreground transition-colors" />
                  </motion.div>
                  <h3 className="font-bold text-lg mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </motion.div>
              </ScrollReveal>
            ))}
          </div>

          {/* Merchant CTA */}
          <ScrollReveal delay={0.3} direction="scale">
            <div className="mt-20 max-w-3xl mx-auto text-center p-10 rounded-3xl bg-gradient-to-br from-primary/5 via-accent/5 to-primary/10 border border-primary/10 relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.08),transparent_50%)]" />
              <div className="relative">
                <motion.div
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.6 }}
                >
                  <Store className="h-10 w-10 text-primary mx-auto mb-5" />
                </motion.div>
                <h3 className="text-2xl md:text-3xl font-bold mb-3">Run a restaurant?</h3>
                <p className="text-muted-foreground mb-8 max-w-lg mx-auto leading-relaxed">
                  Manage waitlists, kitchen orders, table reservations, loyalty programs, and more from a single powerful dashboard.
                </p>
                <Button
                  size="lg"
                  onClick={() => navigate("/merchant/signup")}
                  className="px-8 h-13 rounded-2xl shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all"
                >
                  Start Free Trial <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Client Logos */}
      <ClientLogos />

      {/* About */}
      <section id="about" className="py-24 md:py-32 bg-muted/20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <ScrollReveal>
              <p className="text-sm font-medium uppercase tracking-widest text-primary mb-3">Our Story</p>
              <h2 className="text-3xl md:text-5xl font-bold mb-8">
                About <HighlightText>ReadyUp</HighlightText>
              </h2>
            </ScrollReveal>
            <ScrollReveal delay={0.2}>
              <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                ReadyUp was born from a simple frustration — <HighlightText>waiting without knowing</HighlightText>. Whether it's standing at a busy restaurant 
                wondering when your table will be ready, or hovering at the counter unsure if your food is done, the uncertainty 
                ruins the experience.
              </p>
            </ScrollReveal>
            <ScrollReveal delay={0.3}>
              <p className="text-lg text-muted-foreground leading-relaxed mb-8">
                We're building a platform that connects diners and restaurants in real time, eliminating the guesswork from 
                dining out. From smart waitlists to live kitchen tracking, from loyalty rewards to instant communication — 
                ReadyUp <HighlightText>puts you in control</HighlightText>.
              </p>
            </ScrollReveal>
            <ScrollReveal delay={0.4}>
              <p className="text-xl font-medium">
                Built in South Africa 🇿🇦 for the world.
              </p>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="py-24 md:py-32">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <div className="text-center mb-14">
              <p className="text-sm font-medium uppercase tracking-widest text-primary mb-3">Let's Connect</p>
              <h2 className="text-3xl md:text-5xl font-bold">
                Get In <HighlightText>Touch</HighlightText>
              </h2>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.2}>
            <div className="max-w-md mx-auto text-center space-y-6">
              <motion.a
                href="mailto:hello@readyup.app"
                className="flex items-center justify-center gap-3 p-5 rounded-2xl border bg-card/60 hover:bg-card hover:shadow-xl transition-all text-foreground group"
                whileHover={{ scale: 1.02 }}
              >
                <Mail className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
                <span className="font-medium">hello@readyup.app</span>
              </motion.a>

              <div className="flex justify-center gap-4 pt-6">
                {[
                  { icon: Instagram, href: "https://instagram.com/readyupapp", label: "Instagram" },
                  { icon: Twitter, href: "https://x.com/readyupapp", label: "X (Twitter)" },
                  { icon: Facebook, href: "https://facebook.com/readyupapp", label: "Facebook" },
                ].map((social, i) => (
                  <motion.a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.label}
                    className="w-14 h-14 rounded-2xl border bg-card/60 hover:bg-primary/10 hover:border-primary/20 flex items-center justify-center transition-all duration-300"
                    whileHover={{ y: -4, scale: 1.05 }}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 + i * 0.1 }}
                  >
                    <social.icon className="h-5 w-5 text-muted-foreground" />
                  </motion.a>
                ))}
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12 bg-muted/10">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <img src={logo} alt="ReadyUp" className="h-8 w-auto" />
              <span className="text-sm text-muted-foreground">© {new Date().getFullYear()} ReadyUp. All rights reserved.</span>
            </div>
            <div className="flex items-center gap-8 text-sm">
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
