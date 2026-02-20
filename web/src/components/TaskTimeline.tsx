import { Check, Circle, Loader2 } from "lucide-react";

export interface TimelineStep {
  label: string;
  timestamp: string | null;
  status: "completed" | "active" | "pending";
}

interface TaskTimelineProps {
  steps: TimelineStep[];
}

export function TaskTimeline({ steps }: TaskTimelineProps) {
  return (
    <div className="space-y-0">
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        return (
          <div key={step.label} className="flex gap-4">
            {/* Icon column */}
            <div className="flex flex-col items-center">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                  step.status === "completed"
                    ? "bg-accent text-background"
                    : step.status === "active"
                    ? "bg-accent/20 text-accent"
                    : "bg-surface-2 text-muted-2"
                }`}
              >
                {step.status === "completed" ? (
                  <Check className="w-3.5 h-3.5" />
                ) : step.status === "active" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Circle className="w-3 h-3" />
                )}
              </div>
              {!isLast && (
                <div
                  className={`w-0.5 flex-1 min-h-[24px] ${
                    step.status === "completed" ? "bg-accent" : "bg-surface-2"
                  }`}
                />
              )}
            </div>

            {/* Content column */}
            <div className="pb-6">
              <p
                className={`text-sm font-medium ${
                  step.status === "completed"
                    ? "text-foreground"
                    : step.status === "active"
                    ? "text-accent"
                    : "text-muted"
                }`}
              >
                {step.label}
              </p>
              {step.timestamp && (
                <p className="text-xs text-muted-2 mt-0.5">
                  {new Date(step.timestamp).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
