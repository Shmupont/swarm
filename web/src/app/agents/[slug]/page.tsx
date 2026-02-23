"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Star,
  Zap,
  Clock,
  ExternalLink,
  Github,
  Globe,
  MessageSquare,
  ArrowLeft,
  FileText,
  Info,
  Send,
  Bot,
  Copy,
  Check,
  Package,
  Key,
  Network,
  X,
} from "lucide-react";
import { NavBar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { PostCard } from "@/components/post-card";
import { DockStatusBadge } from "@/components/DockStatusBadge";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getAgentBySlug,
  getAgentPosts,
  getAgentPricingPlans,
  purchaseAgentAccess,
  hireAgent,
  getAgentLicenseStatus,
  getTrialStatus,
  sendTrialMessage,
} from "@/lib/api";
import { isLoggedIn, getToken } from "@/lib/auth";
import { getCategoryLabel } from "@/lib/categories";
import type { AgentProfile, AgentPost, PricingPlan, PurchaseResponse } from "@/lib/api";

type Tab = "posts" | "about";

interface TrialMessage {
  role: "user" | "assistant";
  content: string;
}

export default function AgentProfilePage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [agent, setAgent] = useState<AgentProfile | null>(null);
  const [posts, setPosts] = useState<AgentPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("posts");

  // OpenClaw state
  const [pricingPlans, setPricingPlans] = useState<PricingPlan[]>([]);
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseResult, setPurchaseResult] = useState<PurchaseResponse | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Hire / chat state
  const [hiring, setHiring] = useState(false);
  const [hasLicense, setHasLicense] = useState(false);
  const [hireError, setHireError] = useState("");

  // Trial state
  const [trialOpen, setTrialOpen] = useState(false);
  const [trialMessages, setTrialMessages] = useState<TrialMessage[]>([]);
  const [trialInput, setTrialInput] = useState("");
  const [trialLoading, setTrialLoading] = useState(false);
  const [trialMessagesUsed, setTrialMessagesUsed] = useState(0);
  const [trialMaxMessages] = useState(3);
  const [trialExhausted, setTrialExhausted] = useState(false);
  const trialBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    getAgentBySlug(slug)
      .then((a) => {
        setAgent(a);
        if (a.listing_type === "openclaw") {
          getAgentPricingPlans(a.id).then(setPricingPlans).catch(() => {});
        }
        if (a.listing_type === "chat" && a.is_chat_ready && isLoggedIn()) {
          const token = getToken();
          if (token) {
            getAgentLicenseStatus(a.id, token)
              .then((status) => setHasLicense(status.has_license))
              .catch(() => {});
            getTrialStatus(a.id, token)
              .then((status) => {
                setTrialMessagesUsed(status.messages_used);
                setTrialExhausted(status.exhausted);
              })
              .catch(() => {});
          }
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));

    setPostsLoading(true);
    getAgentPosts(slug, { limit: 50 })
      .then(setPosts)
      .catch(() => {})
      .finally(() => setPostsLoading(false));
  }, [slug]);

  useEffect(() => {
    trialBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [trialMessages]);

  const handleContact = () => {
    if (!isLoggedIn()) { router.push("/login"); return; }
    router.push(`/dashboard/messages?agent=${agent?.id}&name=${encodeURIComponent(agent?.name || "")}`);
  };

  const handleSendTask = () => {
    if (!isLoggedIn()) { router.push("/login"); return; }
    router.push(`/dashboard/tasks/new?agent=${agent?.id}&name=${encodeURIComponent(agent?.name || "")}`);
  };

  const handleChat = () => {
    if (!isLoggedIn()) { router.push("/login"); return; }
    router.push(`/agents/${slug}/chat`);
  };

  const handleHire = async () => {
    if (!isLoggedIn()) { router.push(`/login?redirect=/agents/${slug}`); return; }
    if (!agent) return;
    const token = getToken();
    if (!token) return;
    setHiring(true);
    setHireError("");
    try {
      await hireAgent(agent.id, token);
      router.push(`/agents/${slug}/chat`);
    } catch (err) {
      if (err instanceof Error && err.message.includes("402")) {
        setHireError(`Insufficient credits. Top up at /credits.`);
      } else {
        setHireError(err instanceof Error ? err.message : "Failed to hire agent");
      }
    } finally {
      setHiring(false);
    }
  };

  const handleTryFree = () => {
    if (!isLoggedIn()) { router.push(`/login?redirect=/agents/${slug}`); return; }
    setTrialOpen(true);
  };

  const sendTrial = async () => {
    if (!trialInput.trim() || trialLoading || !agent) return;
    const token = getToken();
    if (!token) return;
    const userMsg: TrialMessage = { role: "user", content: trialInput.trim() };
    setTrialMessages((prev) => [...prev, userMsg]);
    setTrialInput("");
    setTrialLoading(true);
    try {
      const res = await sendTrialMessage(agent.id, userMsg.content, token);
      setTrialMessages((prev) => [...prev, { role: "assistant", content: res.response }]);
      setTrialMessagesUsed(res.messages_used);
      if (res.messages_remaining === 0) setTrialExhausted(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error";
      if (msg.includes("trial_exhausted") || msg.includes("exhausted")) {
        setTrialExhausted(true);
      }
      setTrialMessages((prev) => [...prev, { role: "assistant", content: "Something went wrong. Please try again." }]);
    } finally {
      setTrialLoading(false);
    }
  };

  const handlePurchase = async (planId: string) => {
    if (!isLoggedIn()) { router.push("/login"); return; }
    const token = getToken();
    if (!token) return;
    setPurchasing(true);
    try {
      const result = await purchaseAgentAccess(token, slug, planId);
      setPurchaseResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Purchase failed");
    } finally {
      setPurchasing(false);
    }
  };

  const copyKey = async (key: string) => {
    await navigator.clipboard.writeText(key);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <NavBar />
        <main className="flex-1 pt-24 pb-12">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <Skeleton className="h-8 w-48 mb-4" />
            <Skeleton className="h-40 mb-6" />
            <Skeleton className="h-60" />
          </div>
        </main>
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="min-h-screen flex flex-col">
        <NavBar />
        <main className="flex-1 pt-24 pb-12 flex items-center justify-center">
          <div className="text-center">
            <h1 className="font-display text-2xl font-bold text-foreground mb-2">Agent Not Found</h1>
            <p className="text-muted mb-4">{error || "This agent doesn't exist."}</p>
            <Button onClick={() => router.push("/browse")}>Browse Agents</Button>
          </div>
        </main>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "posts", label: "Posts", icon: <FileText className="w-4 h-4" /> },
    { key: "about", label: "About", icon: <Info className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />

      <main className="flex-1 pt-24 pb-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            {/* Header */}
            <Card className="p-8 mb-6">
              <div className="flex flex-col sm:flex-row gap-5">
                <Avatar src={agent.avatar_url} name={agent.name} size="xl" className="shrink-0" />
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground">
                        {agent.name}
                      </h1>
                      <p className="text-muted mt-1 text-lg">{agent.tagline}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {agent.listing_type === "openclaw" ? (
                        <Button onClick={() => setActiveTab("about")} className="gap-2">
                          <Package className="w-4 h-4" /> Get Access
                        </Button>
                      ) : (
                        <div className="flex flex-col items-end gap-1">
                          {agent.price_per_message_credits > 0 && (
                            <p className="text-sm text-muted">
                              <span className="text-accent font-bold">⚡ {agent.price_per_message_credits}</span>
                              <span className="text-xs ml-1">credits/msg</span>
                            </p>
                          )}
                          {hasLicense ? (
                            <Button onClick={handleChat} className="gap-2">
                              <Bot className="w-4 h-4" /> Continue Chatting →
                            </Button>
                          ) : (
                            <Button onClick={handleHire} disabled={hiring} className="gap-2">
                              <Bot className="w-4 h-4" />
                              {hiring ? "..." : agent.price_per_message_credits === 0 ? "Chat Free →" : "Hire Agent →"}
                            </Button>
                          )}
                          {/* Try Free button */}
                          {!hasLicense && (
                            <div className="text-right">
                              <div className="flex items-center gap-2 my-1">
                                <div className="h-px bg-border flex-1" />
                                <span className="text-xs text-muted">or</span>
                                <div className="h-px bg-border flex-1" />
                              </div>
                              {trialExhausted ? (
                                <p className="text-xs text-muted">You&apos;ve used your 3 free messages</p>
                              ) : (
                                <button
                                  onClick={handleTryFree}
                                  className="text-sm text-accent hover:text-accent-hover transition-colors font-medium"
                                >
                                  Try 3 Free Messages
                                </button>
                              )}
                              <p className="text-xs text-muted mt-0.5">No credits needed</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <DockStatusBadge isDocked={agent.is_docked} hasWebhook={!!agent.api_endpoint} />
                    {agent.is_docked && agent.status === "active" && (
                      <a
                        href="/a2a"
                        title="This agent is discoverable via A2A protocol"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
                      >
                        <Network className="w-3 h-3" />
                        A2A Compatible
                      </a>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 mt-3">
                    <Badge category={agent.category}>{getCategoryLabel(agent.category)}</Badge>
                    {agent.owner_display_name && (
                      <span className="text-sm text-muted">by {agent.owner_display_name}</span>
                    )}
                  </div>

                  {hireError && (
                    <div className="mt-3 text-sm text-error bg-error/10 px-3 py-2 rounded-xl">
                      {hireError}{" "}
                      {hireError.includes("credits") && (
                        <a href="/credits" className="underline hover:text-accent">Top up →</a>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-3 mt-5">
                    {agent.avg_rating != null && (
                      <div className="bg-surface-2 rounded-xl px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <Star className="w-3.5 h-3.5 text-accent" />
                          <span className="font-mono font-bold text-foreground">{agent.avg_rating.toFixed(1)}</span>
                        </div>
                        <p className="text-xs text-muted mt-0.5">Rating</p>
                      </div>
                    )}
                    <div className="bg-surface-2 rounded-xl px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-muted" />
                        <span className="font-mono font-bold text-foreground">{agent.total_hires.toLocaleString()}</span>
                      </div>
                      <p className="text-xs text-muted mt-0.5">Hires</p>
                    </div>
                    {agent.response_time_hours != null && (
                      <div className="bg-surface-2 rounded-xl px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-muted" />
                          <span className="font-mono font-bold text-foreground">
                            {agent.response_time_hours < 1
                              ? `${Math.round(agent.response_time_hours * 60)}m`
                              : `${agent.response_time_hours}h`}
                          </span>
                        </div>
                        <p className="text-xs text-muted mt-0.5">Response</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Inline Trial Chat Panel */}
              {trialOpen && (
                <div className="mt-6 border border-accent/20 rounded-2xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 bg-accent/5 border-b border-accent/20">
                    <div>
                      <span className="font-medium text-foreground text-sm">Trial Chat (3 free messages)</span>
                      <span className="ml-3 text-xs text-muted">
                        Messages remaining: {trialMaxMessages - trialMessagesUsed}
                      </span>
                    </div>
                    <button onClick={() => setTrialOpen(false)} className="text-muted hover:text-foreground">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="h-48 overflow-y-auto p-4 space-y-3 bg-surface">
                    {trialMessages.length === 0 && (
                      <div className="p-3 rounded-xl bg-surface-2 text-sm text-muted">
                        {agent.welcome_message || `Hi! I'm ${agent.name}. Send me a message to try me out!`}
                      </div>
                    )}
                    {trialMessages.map((msg, i) => (
                      <div
                        key={i}
                        className={`p-3 rounded-xl text-sm ${
                          msg.role === "user"
                            ? "bg-accent/10 text-accent ml-8"
                            : "bg-surface-2 text-muted"
                        }`}
                      >
                        {msg.content}
                      </div>
                    ))}
                    {trialLoading && (
                      <div className="p-3 rounded-xl bg-surface-2 text-sm text-muted animate-pulse">
                        Thinking...
                      </div>
                    )}
                    <div ref={trialBottomRef} />
                  </div>
                  {trialExhausted ? (
                    <div className="p-4 border-t border-[#1a2d4a] bg-surface text-center">
                      <p className="text-sm text-muted mb-3">Trial complete — hire this agent to keep chatting</p>
                      <Button onClick={handleHire} disabled={hiring} size="sm">
                        {hiring ? "..." : "Hire Agent →"}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-3 border-t border-[#1a2d4a] bg-surface">
                      <input
                        type="text"
                        value={trialInput}
                        onChange={(e) => setTrialInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && sendTrial()}
                        placeholder="Type your message..."
                        disabled={trialLoading}
                        className="flex-1 bg-surface-2 rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/30"
                      />
                      <button
                        onClick={sendTrial}
                        disabled={trialLoading || !trialInput.trim()}
                        className="text-accent hover:text-accent-hover disabled:opacity-50 disabled:pointer-events-none"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </Card>

            {/* Tabs */}
            <div className="flex items-center gap-1 bg-surface rounded-2xl p-1.5 mb-6">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all flex-1 justify-center ${
                    activeTab === tab.key ? "bg-surface-2 text-accent" : "text-muted hover:text-foreground"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                  {tab.key === "posts" && posts.length > 0 && (
                    <span className="text-xs font-mono text-muted-2">({posts.length})</span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab content */}
            {activeTab === "posts" && (
              <div className="space-y-4">
                {postsLoading ? (
                  <>
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="bg-surface rounded-2xl p-5">
                        <div className="flex items-start gap-3">
                          <Skeleton className="w-11 h-11 !rounded-squircle" />
                          <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-40" />
                            <Skeleton className="h-3 w-24" />
                          </div>
                        </div>
                        <Skeleton className="h-16 mt-3" />
                      </div>
                    ))}
                  </>
                ) : posts.length === 0 ? (
                  <div className="text-center py-16">
                    <FileText className="w-12 h-12 text-muted-2 mx-auto mb-4" />
                    <h3 className="font-heading text-lg font-bold text-foreground mb-2">No posts yet</h3>
                    <p className="text-sm text-muted">{agent.name} hasn&apos;t posted anything yet.</p>
                  </div>
                ) : (
                  posts.map((post) => <PostCard key={post.id} post={post} />)
                )}
              </div>
            )}

            {activeTab === "about" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-6">
                  {agent.description && (
                    <Card className="p-6">
                      <h2 className="font-heading text-lg font-bold text-foreground mb-3">About</h2>
                      <div className="text-muted text-sm leading-relaxed whitespace-pre-wrap">{agent.description}</div>
                    </Card>
                  )}
                  {agent.capabilities.length > 0 && (
                    <Card className="p-6">
                      <h2 className="font-heading text-lg font-bold text-foreground mb-3">Capabilities</h2>
                      <div className="flex flex-wrap gap-2">
                        {agent.capabilities.map((cap) => (
                          <span key={cap} className="px-3 py-1.5 rounded-xl bg-accent-muted text-accent text-sm font-medium">{cap}</span>
                        ))}
                      </div>
                    </Card>
                  )}
                  {agent.portfolio.length > 0 && (
                    <Card className="p-6">
                      <h2 className="font-heading text-lg font-bold text-foreground mb-3">Portfolio</h2>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {agent.portfolio.map((item, i) => (
                          <div key={i} className="p-4 bg-surface-2 rounded-xl">
                            <h3 className="font-medium text-foreground text-sm mb-1">{item.title}</h3>
                            <p className="text-muted text-xs">{item.description}</p>
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}
                </div>

                <div className="space-y-6">
                  {purchaseResult && (
                    <Card className="p-6 border border-accent/30">
                      <div className="flex items-center gap-2 mb-3">
                        <Key className="w-5 h-5 text-accent" />
                        <h2 className="font-heading text-lg font-bold text-accent">Access Granted</h2>
                      </div>
                      <p className="text-sm text-muted mb-3">Your license key:</p>
                      <div className="flex items-center gap-2 mb-4">
                        <code className="flex-1 text-xs font-mono bg-surface-2 px-3 py-2 rounded-lg text-foreground break-all">
                          {purchaseResult.license_key}
                        </code>
                        <button onClick={() => copyKey(purchaseResult.license_key)} className="text-muted hover:text-accent transition-colors shrink-0">
                          {copiedKey ? <Check className="w-4 h-4 text-accent" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                      <p className="text-xs text-muted mb-2">Proxy URL:</p>
                      <code className="block text-xs font-mono bg-surface-2 px-3 py-2 rounded-lg text-foreground break-all mb-4">
                        {purchaseResult.proxy_url}
                      </code>
                      <div className="bg-surface-2 rounded-xl p-4 text-xs font-mono text-muted whitespace-pre-wrap">
                        {purchaseResult.setup_instructions}
                      </div>
                    </Card>
                  )}

                  {agent.listing_type === "openclaw" && pricingPlans.length > 0 && !purchaseResult && (
                    <div className="space-y-3">
                      <h2 className="font-heading text-lg font-bold text-foreground">Pricing Plans</h2>
                      {pricingPlans.map((plan) => (
                        <Card key={plan.id} className="p-5">
                          <div className="flex items-start justify-between mb-2">
                            <h3 className="font-heading font-bold text-foreground">{plan.plan_name}</h3>
                            <span className="font-mono font-bold text-accent text-lg">${(plan.price_cents / 100).toFixed(2)}</span>
                          </div>
                          {plan.plan_description && (
                            <p className="text-sm text-muted mb-3">{plan.plan_description}</p>
                          )}
                          <div className="space-y-1 text-xs text-muted mb-4">
                            <p className="capitalize">{plan.plan_type.replace("_", " ")}
                              {plan.billing_interval && ` (${plan.billing_interval})`}
                              {plan.rental_duration_days && ` (${plan.rental_duration_days} days)`}
                            </p>
                            {plan.max_messages_per_period && (
                              <p>{plan.max_messages_per_period.toLocaleString()} requests/period</p>
                            )}
                            {plan.max_tokens_per_period && (
                              <p>{plan.max_tokens_per_period.toLocaleString()} tokens/period</p>
                            )}
                          </div>
                          <Button onClick={() => handlePurchase(plan.id)} disabled={purchasing} className="w-full gap-2">
                            <Key className="w-4 h-4" />
                            {purchasing ? "Processing..." : "Get Access"}
                          </Button>
                        </Card>
                      ))}
                    </div>
                  )}

                  {agent.listing_type === "openclaw" && (
                    <Card className="p-6">
                      <h2 className="font-heading text-lg font-bold text-foreground mb-3">OpenClaw Agent</h2>
                      {agent.openclaw_version && (
                        <p className="text-sm text-muted mb-2">
                          Version: <span className="font-mono text-foreground">{agent.openclaw_version}</span>
                        </p>
                      )}
                      {agent.openclaw_repo_url && (
                        <a href={agent.openclaw_repo_url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-muted hover:text-accent transition-colors mb-2">
                          <Github className="w-4 h-4" /> Repository
                          <ExternalLink className="w-3 h-3 ml-auto" />
                        </a>
                      )}
                      {agent.openclaw_install_instructions && (
                        <div className="mt-3">
                          <p className="text-xs text-muted mb-1.5">Install Instructions:</p>
                          <div className="bg-surface-2 rounded-xl p-3 text-xs font-mono text-muted whitespace-pre-wrap">
                            {agent.openclaw_install_instructions}
                          </div>
                        </div>
                      )}
                    </Card>
                  )}

                  {agent.listing_type !== "openclaw" && agent.pricing_model && (
                    <Card className="p-6">
                      <h2 className="font-heading text-lg font-bold text-foreground mb-3">Pricing</h2>
                      <p className="text-sm text-muted capitalize mb-3">{agent.pricing_model.replace(/[-_]/g, " ")}</p>
                      {Object.entries(agent.pricing_details).map(([key, val]) => (
                        <div key={key} className="flex justify-between py-2">
                          <span className="text-sm text-muted capitalize">{key.replace(/[-_]/g, " ")}</span>
                          <span className="text-sm font-mono font-bold text-foreground">${val}</span>
                        </div>
                      ))}
                    </Card>
                  )}

                  {(agent.demo_url || agent.source_url || agent.api_endpoint) && (
                    <Card className="p-6">
                      <h2 className="font-heading text-lg font-bold text-foreground mb-3">Links</h2>
                      <div className="space-y-2">
                        {agent.demo_url && (
                          <a href={agent.demo_url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm text-muted hover:text-accent transition-colors">
                            <Globe className="w-4 h-4" /> Demo
                            <ExternalLink className="w-3 h-3 ml-auto" />
                          </a>
                        )}
                        {agent.source_url && (
                          <a href={agent.source_url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm text-muted hover:text-accent transition-colors">
                            <Github className="w-4 h-4" /> Source Code
                            <ExternalLink className="w-3 h-3 ml-auto" />
                          </a>
                        )}
                        {agent.api_endpoint && (
                          <a href={agent.api_endpoint} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm text-muted hover:text-accent transition-colors">
                            <Zap className="w-4 h-4" /> API Endpoint
                            <ExternalLink className="w-3 h-3 ml-auto" />
                          </a>
                        )}
                      </div>
                    </Card>
                  )}

                  {agent.tags.length > 0 && (
                    <Card className="p-6">
                      <h2 className="font-heading text-lg font-bold text-foreground mb-3">Tags</h2>
                      <div className="flex flex-wrap gap-2">
                        {agent.tags.map((tag) => (
                          <Badge key={tag} variant="tag">{tag}</Badge>
                        ))}
                      </div>
                    </Card>
                  )}

                  {agent.listing_type !== "openclaw" && (
                    <>
                      <div className="space-y-2">
                        {agent.price_per_message_credits > 0 && (
                          <p className="text-center">
                            <span className="text-accent font-bold text-lg">⚡ {agent.price_per_message_credits}</span>
                            <span className="text-muted text-sm ml-1">credits / message</span>
                          </p>
                        )}
                        {hasLicense ? (
                          <Button onClick={handleChat} className="w-full gap-2">
                            <Bot className="w-4 h-4" /> Continue Chatting →
                          </Button>
                        ) : (
                          <>
                            <Button onClick={handleHire} disabled={hiring} className="w-full gap-2">
                              <Bot className="w-4 h-4" />
                              {hiring ? "Processing..." : agent.price_per_message_credits === 0 ? "Chat Free →" : "Hire Agent →"}
                            </Button>
                            <div className="flex items-center gap-2 my-1">
                              <div className="h-px bg-border flex-1" />
                              <span className="text-xs text-muted">or</span>
                              <div className="h-px bg-border flex-1" />
                            </div>
                            {trialExhausted ? (
                              <p className="text-xs text-muted text-center">You&apos;ve used your 3 free messages</p>
                            ) : (
                              <Button variant="ghost" onClick={handleTryFree} className="w-full">
                                Try 3 Free Messages
                              </Button>
                            )}
                            <p className="text-xs text-muted text-center">No credits needed</p>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
