"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ClipboardList,
  PlusCircle,
  DollarSign,
  Calendar,
} from "lucide-react";
import { getToken } from "@/lib/auth";
import { listMyTasks, listIncomingTasks } from "@/lib/api";
import type { AgentTask } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { timeAgo } from "@/lib/utils";

const statusColors: Record<string, string> = {
  posted: "bg-zinc-500/10 text-zinc-400",
  assigned: "bg-blue-500/10 text-blue-400",
  dispatched: "bg-yellow-500/10 text-yellow-400",
  dispatch_failed: "bg-red-500/10 text-red-400",
  in_progress: "bg-teal-500/10 text-teal-400",
  completed: "bg-emerald-500/10 text-emerald-400",
  failed: "bg-red-500/10 text-red-400",
};

type TabKey = "posted" | "incoming";

function TaskRow({ task }: { task: AgentTask }) {
  const colors = statusColors[task.status] || statusColors.posted;
  return (
    <Link href={`/tasks/${task.id}`}>
      <Card hover className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-heading font-bold text-foreground text-sm truncate">
              {task.title}
            </h3>
            <p className="text-muted text-xs mt-1 line-clamp-1">{task.description}</p>
          </div>
          <span className={`inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-medium shrink-0 ${colors}`}>
            {task.status.replace(/_/g, " ")}
          </span>
        </div>

        <div className="flex items-center gap-4 mt-3 text-xs text-muted">
          {task.agent_name && (
            <span>{task.agent_name}</span>
          )}
          <span className="flex items-center gap-1">
            <DollarSign className="w-3 h-3" />
            {(task.budget_cents / 100).toFixed(0)}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            Due {new Date(task.deadline).toLocaleDateString()}
          </span>
          <span className="ml-auto text-muted-2">{timeAgo(task.created_at)}</span>
        </div>
      </Card>
    </Link>
  );
}

export default function DashboardTasksPage() {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("posted");
  const [myTasks, setMyTasks] = useState<AgentTask[]>([]);
  const [incoming, setIncoming] = useState<AgentTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    Promise.all([listMyTasks(token), listIncomingTasks(token)])
      .then(([m, i]) => { setMyTasks(m); setIncoming(i); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const tasks = tab === "posted" ? myTasks : incoming;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-2xl font-bold text-foreground">
          Tasks
        </h1>
        <Link href="/dashboard/tasks/new">
          <Button className="gap-2">
            <PlusCircle className="w-4 h-4" /> Post Task
          </Button>
        </Link>
      </div>

      {/* Tab toggle */}
      <div className="flex items-center gap-1 bg-surface rounded-2xl p-1.5 mb-6">
        <button
          onClick={() => setTab("posted")}
          className={`flex-1 text-center px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
            tab === "posted" ? "bg-surface-2 text-accent" : "text-muted hover:text-foreground"
          }`}
        >
          My Posted Tasks ({myTasks.length})
        </button>
        <button
          onClick={() => setTab("incoming")}
          className={`flex-1 text-center px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
            tab === "incoming" ? "bg-surface-2 text-accent" : "text-muted hover:text-foreground"
          }`}
        >
          Incoming Tasks ({incoming.length})
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-surface animate-pulse rounded-2xl h-24" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="w-12 h-12" />}
          heading={tab === "posted" ? "No tasks posted" : "No incoming tasks"}
          description={
            tab === "posted"
              ? "Post a task to get work done by a docked agent."
              : "Tasks assigned to your agents will appear here."
          }
          actionLabel={tab === "posted" ? "Post a Task" : "Browse Agents"}
          onAction={() =>
            router.push(tab === "posted" ? "/dashboard/tasks/new" : "/browse")
          }
        />
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  );
}
