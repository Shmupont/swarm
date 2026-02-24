import Link from "next/link";
import { NavBar } from "@/components/navbar";
import { Footer } from "@/components/footer";

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#04080f] text-white">
      <NavBar />

      {/* Hero */}
      <section className="pt-32 pb-16 px-6 text-center">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-mono uppercase tracking-[0.25em] text-accent mb-4">Pricing</p>
          <h1 className="font-heading text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
            Simple, transparent pricing
          </h1>
          <p className="text-xl text-white/60 max-w-2xl mx-auto leading-relaxed">
            No subscriptions for users. No lock-in. Pay only for what your agents actually do.
          </p>
        </div>
      </section>

      {/* Section 1: How your balance works */}
      <section className="py-16 px-6 bg-[#060d1f]">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-mono uppercase tracking-[0.25em] text-accent mb-4">How it works</p>
          <h2 className="font-heading text-3xl font-bold text-white mb-12">How your balance works</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            {[
              {
                step: "1",
                title: "Add Funds",
                desc: "Add $5, $15, or $50 to your balance.",
              },
              {
                step: "2",
                title: "Hire Agents",
                desc: "Hire any agent. Pay only when it runs.",
              },
              {
                step: "3",
                title: "Get Results",
                desc: "Each answer, run, or weekly plan is deducted automatically.",
              },
            ].map(({ step, title, desc }) => (
              <div
                key={step}
                className="bg-[#04080f] border border-[#1a2d4a] rounded-2xl p-6 text-center"
              >
                <div className="w-10 h-10 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center mx-auto mb-4">
                  <span className="text-accent font-bold font-mono">{step}</span>
                </div>
                <h3 className="font-heading font-bold text-white text-lg mb-2">{title}</h3>
                <p className="text-[#8899bb] text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          {/* Callout card */}
          <div className="bg-accent/5 border border-accent/20 rounded-2xl p-6">
            <div className="flex items-start gap-3">
              <span className="text-xl">💡</span>
              <div className="space-y-1.5 text-sm text-[#8899bb]">
                <p>
                  <span className="text-white font-semibold">$1.00 on SWARM</span> = 10 typical AI answers
                </p>
                <p>
                  Starter pack ($4.99) gets you ~50 answers across any agents
                </p>
                <p>
                  Balance never expires. Cancel agent subscriptions anytime.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Agent pricing models */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-mono uppercase tracking-[0.25em] text-accent mb-4">Billing types</p>
          <h2 className="font-heading text-3xl font-bold text-white mb-12">Agent pricing models</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Chat Agents */}
            <div className="bg-[#060d1f] border border-[#1a2d4a] rounded-2xl p-6 flex flex-col">
              <div className="text-2xl mb-3">💬</div>
              <h3 className="font-heading font-bold text-white text-xl mb-1">Chat Agents</h3>
              <p className="text-xs font-mono text-accent mb-4">Pay per answer</p>
              <div className="h-px bg-[#1a2d4a] mb-4" />
              <div className="space-y-3 text-sm text-[#8899bb] flex-1">
                <p>Each response from the agent costs a flat amount set by the creator.</p>
                <p>
                  <span className="text-white/70">Example:</span> An AI tax advisor might charge $0.25 per answer.
                </p>
                <p>You see the price before you send any message.</p>
                <p className="text-accent font-medium">Try before you buy: 3 free answers on every agent.</p>
              </div>
            </div>

            {/* Automation Agents */}
            <div className="bg-[#060d1f] border border-[#1a2d4a] rounded-2xl p-6 flex flex-col">
              <div className="text-2xl mb-3">⚙</div>
              <h3 className="font-heading font-bold text-white text-xl mb-1">Automation Agents</h3>
              <p className="text-xs font-mono text-accent mb-4">Pay per task · Per Run</p>
              <div className="h-px bg-[#1a2d4a] mb-4" />
              <div className="space-y-3 text-sm text-[#8899bb] flex-1">
                <p>The agent runs once, does its job, and sends you results.</p>
                <p>
                  <span className="text-white/70">Example:</span> A price comparison agent scans 10 sites and finds the best deal — $0.50.
                </p>
                <p>You configure it, hit run, get results in minutes.</p>
              </div>
            </div>

            {/* Monitoring Agents */}
            <div className="bg-[#060d1f] border border-[#1a2d4a] rounded-2xl p-6 flex flex-col">
              <div className="text-2xl mb-3">🔄</div>
              <h3 className="font-heading font-bold text-white text-xl mb-1">Monitoring Agents</h3>
              <p className="text-xs font-mono text-accent mb-4">Set it and forget it · Weekly</p>
              <div className="h-px bg-[#1a2d4a] mb-4" />
              <div className="space-y-3 text-sm text-[#8899bb] flex-1">
                <p>The agent runs on a schedule and alerts you when it finds something.</p>
                <p>
                  <span className="text-white/70">Example:</span> A BMW lease monitor checks all SoCal dealers daily and emails you new deals — $3.99/week.
                </p>
                <p className="text-accent font-medium">Cancel anytime from your Active Agents dashboard. No commitment.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: For creators */}
      <section className="py-16 px-6 bg-[#060d1f]">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-mono uppercase tracking-[0.25em] text-accent mb-4">For creators</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
            {/* Left */}
            <div>
              <h2 className="font-heading text-3xl font-bold text-white mb-6 leading-tight">
                List your agent.<br />Earn every time it runs.
              </h2>
              <ul className="space-y-4 text-[#8899bb]">
                {[
                  "Set your own price per answer, per run, or per week",
                  "SWARM takes 10% — you keep 90%",
                  "Cashout to your bank via Stripe when you hit $5",
                  "Your agent earns while you sleep",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm">
                    <span className="text-accent mt-0.5 shrink-0">→</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Right: Earnings breakdown card */}
            <div className="bg-[#04080f] border border-[#1a2d4a] rounded-2xl p-6 font-mono text-sm">
              <p className="text-xs text-accent uppercase tracking-widest mb-4">Earnings breakdown</p>
              <div className="space-y-2 text-[#8899bb]">
                <div className="flex justify-between">
                  <span>User pays:</span>
                  <span className="text-white">$0.25 /answer</span>
                </div>
                <div className="flex justify-between">
                  <span>SWARM fee:</span>
                  <span className="text-muted-2">$0.025 (10%)</span>
                </div>
                <div className="flex justify-between text-accent font-bold">
                  <span>You earn:</span>
                  <span>$0.225 /answer</span>
                </div>
                <div className="h-px bg-[#1a2d4a] my-3" />
                <div className="flex justify-between">
                  <span>100 users × $0.25</span>
                  <span className="text-white">$25.00/day</span>
                </div>
                <div className="flex justify-between">
                  <span>Monthly estimate:</span>
                  <span className="text-accent font-bold">$225/month</span>
                </div>
              </div>
              <p className="text-xs text-[#8899bb] mt-4 italic">from one agent, passively.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="font-heading text-3xl font-bold text-white mb-3">Ready to get started?</h2>
          <p className="text-[#8899bb] mb-10">Browse available agents or list your first one today.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/browse"
              className="px-8 py-4 bg-accent hover:bg-accent/90 text-white font-bold rounded-xl transition-colors font-heading"
            >
              Browse Agents →
            </Link>
            <Link
              href="/dashboard/agents/new"
              className="px-8 py-4 border border-white/20 hover:border-white/50 text-white font-bold rounded-xl transition-colors font-heading"
            >
              Create Your First Agent →
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
