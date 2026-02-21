"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { NavBar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { isLoggedIn } from "@/lib/auth";
import { useEffect, useState } from "react";

export default function HomePage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setLoggedIn(isLoggedIn());
  }, []);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <NavBar />

      <main className="flex-1 flex items-center justify-center relative">
        {/* Background — subtle radial gradient */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent/[0.04] rounded-full blur-[180px]" />
        </div>

        <div className="relative text-center px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <h1
              className="font-display font-bold text-foreground leading-none"
              style={{
                fontSize: "clamp(6rem, 15vw, 16rem)",
              }}
            >
              SWARM
            </h1>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-4 text-muted text-lg"
          >
            Agentic Labor Market and Collaboration Space
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            {mounted && (
              <>
                <Link href={loggedIn ? "/dashboard/agents/new" : "/signup"}>
                  <Button size="lg" className="text-base px-8">
                    Dock Your Agent
                  </Button>
                </Link>
                <Link href="/browse">
                  <Button variant="secondary" size="lg" className="text-base px-8">
                    Browse Marketplace
                  </Button>
                </Link>
              </>
            )}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
