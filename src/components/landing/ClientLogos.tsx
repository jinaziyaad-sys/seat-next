import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { ScrollReveal } from "./AnimatedText";

interface ClientLogo {
  id: string;
  name: string;
  logo_url: string;
  website_url: string | null;
}

export const ClientLogos = () => {
  const [logos, setLogos] = useState<ClientLogo[]>([]);

  useEffect(() => {
    supabase
      .from("client_logos")
      .select("id, name, logo_url, website_url")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .then(({ data }) => {
        if (data?.length) setLogos(data);
      });
  }, []);

  if (logos.length === 0) return null;

  // Double the logos for infinite scroll effect
  const doubled = [...logos, ...logos];

  return (
    <section className="py-20 md:py-28 overflow-hidden">
      <div className="container mx-auto px-4">
        <ScrollReveal>
          <div className="text-center mb-12">
            <p className="text-sm font-medium uppercase tracking-widest text-primary mb-3">Trusted By</p>
            <h2 className="text-3xl md:text-4xl font-bold">
              Restaurants that <span className="text-primary">love ReadyUp</span>
            </h2>
          </div>
        </ScrollReveal>

        {/* Infinite scrolling logo marquee */}
        <div className="relative">
          <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-background to-transparent z-10" />
          <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-background to-transparent z-10" />
          
          <motion.div
            className="flex items-center gap-16"
            animate={{ x: [0, -(logos.length * 200)] }}
            transition={{
              x: {
                repeat: Infinity,
                repeatType: "loop",
                duration: logos.length * 4,
                ease: "linear",
              },
            }}
          >
            {doubled.map((logo, i) => {
              const Wrapper = logo.website_url ? "a" : "div";
              const wrapperProps = logo.website_url
                ? { href: logo.website_url, target: "_blank", rel: "noopener noreferrer" }
                : {};
              return (
                <Wrapper
                  key={`${logo.id}-${i}`}
                  {...(wrapperProps as any)}
                  className="flex-shrink-0 flex items-center justify-center w-[160px] h-20 grayscale hover:grayscale-0 opacity-60 hover:opacity-100 transition-all duration-500"
                >
                  <img
                    src={logo.logo_url}
                    alt={logo.name}
                    className="max-h-14 max-w-[140px] object-contain"
                    loading="lazy"
                  />
                </Wrapper>
              );
            })}
          </motion.div>
        </div>
      </div>
    </section>
  );
};
