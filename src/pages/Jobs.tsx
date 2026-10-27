import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useAccess } from "@/lib/access";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActiveJobsList } from "@/components/jobs/ActiveJobsList";
import { ArchiveJobsList } from "@/components/jobs/ArchiveJobsList";
import { NewJobDialog } from "@/components/jobs/NewJobDialog";
import { fetchJobTabCounts, type JobTabCounts } from "@/components/jobs/jobsQueries";
import { errorMessage } from "@/lib/errorMessage";

type JobsView = "active" | "archive";

/** `?view=archive` opens the Archive tab; anything else is Active. */
function parseJobsView(value: string | null): JobsView {
  return value === "archive" ? "archive" : "active";
}

const Jobs = () => {
  const { can } = useAccess();
  const canEdit = can("jobs.edit");
  const canSeeCustomer = can("jobs.private.view");
  const [searchParams, setSearchParams] = useSearchParams();
  const view = parseJobsView(searchParams.get("view"));
  const [counts, setCounts] = useState<JobTabCounts | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadCounts = useCallback(() => {
    fetchJobTabCounts()
      .then(setCounts)
      .catch((err: unknown) => toast.error(errorMessage(err, "Couldn't load job counts")));
  }, []);

  useEffect(() => { loadCounts(); }, [loadCounts, refreshKey]);

  const setView = (next: string) => {
    setSearchParams((params) => {
      const updated = new URLSearchParams(params);
      updated.set("view", parseJobsView(next));
      return updated;
    }, { replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-6">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Home
        </Link>

        <div className="mt-4 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl uppercase tracking-wide">Jobs</h1>
            <p className="text-sm text-muted-foreground">
              {view === "active" ? "What's running right now" : "Finished projects"}
            </p>
          </div>
          {canEdit && view === "active" && <NewJobDialog onCreated={() => setRefreshKey((k) => k + 1)} />}
        </div>

        <Tabs value={view} onValueChange={setView} className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="active">
              Active <TabCount value={counts?.active} />
            </TabsTrigger>
            <TabsTrigger value="archive">
              Archive <TabCount value={counts?.archive} />
            </TabsTrigger>
          </TabsList>
          <TabsContent value="active" className="mt-4">
            <ActiveJobsList canEdit={canEdit} refreshKey={refreshKey} />
          </TabsContent>
          <TabsContent value="archive" className="mt-4">
            <ArchiveJobsList canSeeCustomer={canSeeCustomer} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

function TabCount({ value }: { value: number | undefined }) {
  if (value === undefined) return null;
  return <span data-testid="tab-count" className="ml-1.5 text-[11px] font-medium opacity-70">{value}</span>;
}

export default Jobs;
