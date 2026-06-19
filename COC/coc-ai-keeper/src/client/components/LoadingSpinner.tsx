export function LoadingSpinner({ label = '加载中...' }: { label?: string }) {
  return (
    <div className="loading-spinner" role="status">
      <span className="spinner-dot" />
      <span>{label}</span>
    </div>
  );
}
