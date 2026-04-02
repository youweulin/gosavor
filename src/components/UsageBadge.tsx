import type { UsageInfo } from '../services/workerProxy';

interface UsageBadgeProps {
  usage?: UsageInfo | null;
  hasOwnKey: boolean;
}

/** Small badge showing remaining usage (only when using system key) */
const UsageBadge = ({ usage, hasOwnKey }: UsageBadgeProps) => {
  if (hasOwnKey || !usage) return null;

  const percent = Math.round((usage.used / usage.limit) * 100);
  const color = usage.remaining <= 1 ? 'text-red-500' :
                usage.remaining <= 3 ? 'text-orange-500' : 'text-green-600';

  return (
    <div className="flex items-center gap-1 px-2 py-0.5 bg-gray-50 rounded-full">
      <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            percent >= 80 ? 'bg-red-400' : percent >= 50 ? 'bg-orange-400' : 'bg-green-400'
          }`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
      <span className={`text-[10px] font-bold ${color}`}>
        {usage.remaining}
      </span>
    </div>
  );
};

export default UsageBadge;
