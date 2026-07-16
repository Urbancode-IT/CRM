// Status colors follow the dataviz skill's fixed status palette (good/warning/critical),
// always paired with an icon + label so meaning never rides on color alone.
const STATUS_STYLES = {
  neutral: { bg: 'bg-brand-50', text: 'text-brand-700', icon: '●' },
  good: { bg: 'bg-[#eaf7ea]', text: 'text-[#0ca30c]', icon: '✓' },
  warning: { bg: 'bg-[#fff6e5]', text: 'text-[#b8790f]', icon: '!' },
  critical: { bg: 'bg-[#fdeaea]', text: 'text-[#d03b3b]', icon: '⚠' },
};

export default function StatCard({ label, value, sublabel, status = 'neutral' }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.neutral;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
        <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${style.bg} ${style.text}`}>
          {style.icon}
        </span>
      </div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
      {sublabel && <div className="mt-1 text-xs text-slate-500">{sublabel}</div>}
    </div>
  );
}
