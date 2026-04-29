import { STATUS_LABEL, PRIORITY_LABEL } from "../lib/constants";

export function StatusBadge({ status }) {
  if (!status) return <span className="text-xs text-slate-400">—</span>;
  return (
    <span
      data-testid={`status-badge-${status}`}
      className={`inline-flex items-center px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider rounded-sm badge-${status}`}
    >
      {STATUS_LABEL[status] || status}
    </span>
  );
}

export function PriorityBadge({ priority }) {
  if (!priority) return <span className="text-xs text-slate-400">—</span>;
  return (
    <span
      data-testid={`priority-badge-${priority}`}
      className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-sm priority-${priority}`}
    >
      {PRIORITY_LABEL[priority] || priority}
    </span>
  );
}
