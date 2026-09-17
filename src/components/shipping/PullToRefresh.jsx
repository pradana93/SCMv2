import { Loader2, ArrowDown } from "lucide-react";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";

export default function PullToRefresh({ onRefresh, children }) {
  const { pullDistance, refreshing } = usePullToRefresh(onRefresh);
  const show = pullDistance > 0 || refreshing;
  const opacity = Math.min(pullDistance / 70, 1);
  const reached = pullDistance >= 70;

  return (
    <>
      {show && (
        <div
          className="flex items-center justify-center overflow-hidden"
          style={{ height: refreshing ? 40 : pullDistance, opacity, transition: refreshing ? "height 0.2s ease" : "none" }}
        >
          {refreshing ? (
            <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
          ) : (
            <ArrowDown className={`h-5 w-5 text-indigo-600 transition-transform duration-200 ${reached ? "rotate-180" : ""}`} />
          )}
        </div>
      )}
      {children}
    </>
  );
}