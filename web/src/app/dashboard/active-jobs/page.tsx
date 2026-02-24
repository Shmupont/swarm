"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Cpu, Play, Pause, X, Clock, Zap, ChevronRight, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getActiveJobs, updateJobStatus, getJobDetails } from "@/lib/api";
import { getToken, isLoggedIn } from "@/lib/auth";
import type { BackgroundJob, JobRun } from "@/lib/api";

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatNextRun(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "soon";
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `in ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `in ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `in ${days}d`;
}

function StatusDot({ status }: { status: string }) {
  if (status === "active") {
    return <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-400">
      <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" /> Active
    </span>;
  }
  if (status === "paused") {
    return <span className="inline-flex items-center gap-1.5 text-xs font-medium text-yellow-400">
      <span className="w-2 h-2 rounded-full bg-yellow-400" /> Paused
    </span>;
  }
  return <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted">
    <span className="w-2 h-2 rounded-full bg-muted" /> {status.charAt(0).toUpperCase() + status.slice(1)}
  </span>;
}

function JobHistoryDrawer({
  jobId,
  agentName,
  onClose,
}: {
  jobId: string;
  agentName: string;
  onClose: () => void;
}) {
  const [runs, setRuns] = useState<JobRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    getJobDetails(token, jobId)
      .then((res) => setRuns(res.runs))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [jobId]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative bg-surface rounded-2xl border border-border w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-heading font-bold text-foreground">{agentName} — Run History</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <p className="text-sm text-muted">Loading...</p>
          ) : runs.length === 0 ? (
            <p className="text-sm text-muted">No runs yet.</p>
          ) : (
            runs.map((run) => (
              <div key={run.id} className="bg-surface-2 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    run.status === "completed"
                      ? "bg-green-400/10 text-green-400"
                      : run.status === "failed"
                      ? "bg-red-400/10 text-red-400"
                      : "bg-yellow-400/10 text-yellow-400"
                  }`}>
                    {run.status}
                  </span>
                  <span className="text-xs text-muted">{formatRelativeTime(run.started_at)}</span>
                </div>
                {run.result && (
                  <p className="text-sm text-muted leading-relaxed">{run.result}</p>
                )}
                {run.error && (
                  <p className="text-sm text-red-400">{run.error}</p>
                )}
                <p className="text-xs text-muted-2 mt-2">{run.credits_charged} credits</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function JobCard({ job, onStatusChange }: { job: BackgroundJob; onStatusChange: () => void }) {
  const [updating, setUpdating] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const handleStatus = async (status: string) => {
    const token = getToken();
    if (!token) return;
    setUpdating(true);
    try {
      await updateJobStatus(token, job.id, status);
      onStatusChange();
    } catch {
      // ignore
    } finally {
      setUpdating(false);
    }
  };

  const creditsDisplay = (job.credits_spent_total / 100).toFixed(2);
  const isTerminal = job.status === "completed" || job.status === "cancelled";

  return (
    <>
      <Card className="p-6">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center">
              <Cpu className="w-4 h-4 text-accent" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-foreground">{job.agent_name || "Agent"}</h3>
              <div className="flex items-center gap-3 mt-0.5">
                <StatusDot status={job.status} />
              </div>
            </div>
          </div>

          {!isTerminal && (
            <div className="flex items-center gap-2 shrink-0">
              {job.status === "active" ? (
                <button
                  onClick={() => handleStatus("paused")}
                  disabled={updating}
                  className="text-xs text-muted hover:text-yellow-400 transition-colors flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-2/80"
                >
                  <Pause className="w-3.5 h-3.5" />
                  Pause
                </button>
              ) : (
                <button
                  onClick={() => handleStatus("active")}
                  disabled={updating}
                  className="text-xs text-muted hover:text-green-400 transition-colors flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-2/80"
                >
                  <Play className="w-3.5 h-3.5" />
                  Resume
                </button>
              )}
              <button
                onClick={() => handleStatus("cancelled")}
                disabled={updating}
                className="text-xs text-muted hover:text-red-400 transition-colors flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-2/80"
              >
                <X className="w-3.5 h-3.5" />
                Stop
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 text-xs text-muted mb-4">
          <span className="capitalize">Runs: {job.schedule}</span>
          {job.last_run_at && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" /> Last: {formatRelativeTime(job.last_run_at)}
            </span>
          )}
          {job.status === "active" && (
            <span>Next: {formatNextRun(job.next_run_at)}</span>
          )}
        </div>

        {job.latest_result && (
          <div className="bg-surface-2 rounded-xl p-4 mb-4">
            <p className="text-xs text-muted uppercase tracking-wide mb-2 font-medium">Latest Result</p>
            <p className="text-sm text-muted leading-relaxed line-clamp-3">{job.latest_result}</p>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-xs text-muted">
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3" /> ${creditsDisplay} spent
            </span>
            <span>{job.run_count} runs total</span>
          </div>
          <button
            onClick={() => setHistoryOpen(true)}
            className="text-xs text-accent hover:text-accent-hover transition-colors flex items-center gap-1"
          >
            View History <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Config preview */}
        {Object.keys(job.config).length > 0 && (
          <div className="mt-3 pt-3 border-t border-border">
            <div className="flex flex-wrap gap-2">
              {Object.entries(job.config).slice(0, 4).map(([k, v]) => (
                <span key={k} className="text-xs bg-surface-2 text-muted px-2 py-0.5 rounded-lg">
                  {k}: <span className="text-foreground">{String(v)}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </Card>

      {historyOpen && (
        <JobHistoryDrawer
          jobId={job.id}
          agentName={job.agent_name || "Agent"}
          onClose={() => setHistoryOpen(false)}
        />
      )}
    </>
  );
}

export default function ActiveJobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<BackgroundJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchJobs = useCallback(() => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    getActiveJobs(token)
      .then(setJobs)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push("/login");
      return;
    }
    fetchJobs();
  }, [fetchJobs, router]);

  const activeCount = jobs.filter((j) => j.status === "active").length;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Cpu className="w-5 h-5 text-accent" />
            <h1 className="font-display text-2xl font-bold text-foreground">Active Agents</h1>
          </div>
          <p className="text-sm text-muted">Background automations running on your behalf</p>
        </div>
        {activeCount > 0 && (
          <span className="text-xs font-medium bg-green-400/10 text-green-400 px-3 py-1.5 rounded-full">
            {activeCount} running
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="bg-surface rounded-2xl p-6 animate-pulse">
              <div className="h-5 bg-surface-2 rounded w-40 mb-3" />
              <div className="h-3 bg-surface-2 rounded w-64 mb-4" />
              <div className="h-16 bg-surface-2 rounded" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-400/10 px-4 py-3 rounded-xl">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-20">
          <Cpu className="w-12 h-12 text-muted-2 mx-auto mb-4" />
          <h2 className="font-heading text-xl font-bold text-foreground mb-2">
            No automation agents running yet
          </h2>
          <p className="text-sm text-muted mb-6 max-w-sm mx-auto">
            Browse automation agents in the marketplace to get started. They&apos;ll run on a schedule
            and deliver results to your inbox.
          </p>
          <Button onClick={() => router.push("/browse")}>
            Browse Marketplace →
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} onStatusChange={fetchJobs} />
          ))}
        </div>
      )}
    </div>
  );
}
