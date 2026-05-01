import { useNavigate } from "react-router-dom";
import { Network, Download } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";

const OrgChart = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface px-4 py-4">
        <button
          onClick={() => navigate("/perks")}
          className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground"
        >
          ← My Perks
        </button>
        <div className="mt-2 flex items-start justify-between gap-2">
          <div>
            <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
              <Network className="h-5 w-5 text-primary" />
              Org Chart
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Schreiber Excavating organizational chart.
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <a href="/org-chart.pdf" download>
              <Download className="mr-1.5 h-4 w-4" /> Download
            </a>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-4 pb-24">
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <object
            data="/org-chart.pdf#view=FitH&toolbar=1"
            type="application/pdf"
            className="h-[80vh] w-full"
            aria-label="Schreiber Excavating org chart"
          >
            <div className="p-6 text-center text-sm text-muted-foreground">
              Your browser can't display PDFs inline.{" "}
              <a href="/org-chart.pdf" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                Open the org chart in a new tab
              </a>
              .
            </div>
          </object>
        </div>
      </main>

      <BottomNav />
    </div>
  );
};

export default OrgChart;
