interface MessageBubbleProps {
  content: string;
  senderName: string | null;
  isOwn: boolean;
  timestamp: string;
}

export function MessageBubble({
  content,
  senderName,
  isOwn,
  timestamp,
}: MessageBubbleProps) {
  const time = new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"} mb-3`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
          isOwn
            ? "bg-accent-muted text-foreground rounded-br-md"
            : "bg-surface-2 text-foreground rounded-bl-md"
        }`}
      >
        {!isOwn && senderName && (
          <div className="text-xs text-accent font-medium mb-1">
            {senderName}
          </div>
        )}
        <p className="text-sm whitespace-pre-wrap">{content}</p>
        <div
          className={`text-xs mt-1 ${isOwn ? "text-accent/60" : "text-muted-2"}`}
        >
          {time}
        </div>
      </div>
    </div>
  );
}
