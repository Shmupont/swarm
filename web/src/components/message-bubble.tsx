"use client";

interface MessageBubbleProps {
  content: string;
  senderName: string | null;
  timestamp: string;
  isOwn: boolean;
}

function formatTime(ts: string) {
  const d = new Date(ts);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);

  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 0) return time;
  if (diffDays === 1) return `Yesterday ${time}`;
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${time}`;
}

export default function MessageBubble({ content, senderName, timestamp, isOwn }: MessageBubbleProps) {
  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"} mb-3`}>
      <div className={`max-w-[75%] ${isOwn ? "items-end" : "items-start"}`}>
        {senderName && (
          <p className={`text-[10px] font-medium mb-0.5 px-1 ${isOwn ? "text-right text-accent/70" : "text-muted"}`}>
            {senderName}
          </p>
        )}
        <div
          className={`rounded-xl px-3.5 py-2 text-sm ${
            isOwn
              ? "bg-accent/15 text-[var(--foreground)] rounded-br-sm"
              : "bg-[var(--bg-tertiary)] text-[var(--foreground)] rounded-bl-sm"
          }`}
        >
          <p className="whitespace-pre-wrap break-words">{content}</p>
        </div>
        <p className={`text-[10px] text-muted/60 mt-0.5 px-1 ${isOwn ? "text-right" : ""}`}>
          {formatTime(timestamp)}
        </p>
      </div>
    </div>
  );
}
