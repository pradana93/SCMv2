export default function MetricCard({ label, value, icon: Icon, tone }) {
  const tones = {
    indigo: "bg-indigo-50 text-indigo-600",
    amber: "bg-amber-50 text-amber-600",
    blue: "bg-blue-50 text-blue-600",
    emerald: "bg-emerald-50 text-emerald-600",
  };
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
    <div className={`mb-5 inline-flex rounded-xl p-2.5 ${tones[tone]}`}><Icon className="h-5 w-5" /></div>
    <p className="text-3xl font-bold tracking-tight">{value}</p>
    <p className="mt-1 text-sm text-slate-500">{label}</p>
  </div>;
}