// Temporary page body for screens built in later milestones.
export function Placeholder({ title }: { title: string }) {
  return (
    <div className="page-head">
      <h1>{title}</h1>
      <p className="lede">Coming in the next milestone.</p>
    </div>
  );
}
