import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  CircleOff,
  Info,
  LoaderCircle,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

type NoticeTone = "info" | "warning" | "error" | "success";

const noticeIcons: Record<NoticeTone, LucideIcon> = {
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
  success: CheckCircle2,
};

export function InlineNotice({
  title,
  children,
  tone = "info",
  actions,
}: {
  title: string;
  children: ReactNode;
  tone?: NoticeTone;
  actions?: ReactNode;
}) {
  const Icon = noticeIcons[tone];
  return (
    <div
      className="inline-notice"
      data-tone={tone}
      role={tone === "error" ? "alert" : "status"}
    >
      <Icon size={20} aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        <div className="notice-copy">{children}</div>
        {actions ? <div className="notice-actions">{actions}</div> : null}
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <CircleOff size={25} aria-hidden="true" />
      <h2>{title}</h2>
      <div>{children}</div>
      {action ? <div className="empty-action">{action}</div> : null}
    </div>
  );
}

export function LoadingState({
  label = "Inhalte werden geladen",
}: {
  label?: string;
}) {
  return (
    <div className="loading-state" role="status" aria-live="polite">
      <LoaderCircle size={21} className="loading-icon" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorSummary({
  title = "Bitte Eingaben prüfen",
  errors,
}: {
  title?: string;
  errors: readonly string[];
}) {
  if (errors.length === 0) return null;
  return (
    <div className="error-summary" role="alert" tabIndex={-1}>
      <AlertCircle size={20} aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        <ul>
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
