import { usePermissions } from "@/components/shipping/usePermissions";

export default function FeatureRoute({ featureKey, children }) {
  const { can } = usePermissions();
  if (!can(`page.${featureKey}`)) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-center px-4">
        <p className="text-lg font-semibold text-slate-700">Akses Dilarang</p>
        <p className="mt-1 text-sm text-slate-500">Anda tidak memiliki akses ke halaman ini.</p>
      </div>
    );
  }
  return children;
}