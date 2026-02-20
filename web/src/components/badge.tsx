const colors: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  contracted: "bg-blue-100 text-blue-700",
  submitted: "bg-yellow-100 text-yellow-700",
  settled: "bg-emerald-100 text-emerald-700",
  disputed: "bg-red-100 text-red-700",
  completed: "bg-emerald-100 text-emerald-700",
  open: "bg-blue-100 text-blue-700",
  funded: "bg-green-100 text-green-700",
};

export default function Badge({ status }: { status: string }) {
  const cls = colors[status] || "bg-gray-100 text-gray-700";
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}
