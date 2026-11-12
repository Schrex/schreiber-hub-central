/** Dashed placeholder for an empty tab. */
export const EmptyState = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-xl border border-dashed border-border p-8 text-center">
    <p className="text-sm text-muted-foreground">{children}</p>
  </div>
);
