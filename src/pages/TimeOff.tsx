import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Palmtree } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { noticeFor } from "@/lib/timeOffNotice";
import { useAccess } from "@/lib/access";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { RequestFormDialog } from "@/components/timeoff/RequestFormDialog";
import { ApprovalsTab } from "@/components/timeoff/ApprovalsTab";
import { MyRequestsTab } from "@/components/timeoff/MyRequestsTab";
import { ApprovedTab } from "@/components/timeoff/ApprovedTab";
import { useTimeOffRequests } from "@/components/timeoff/useTimeOffRequests";

/** Time Off page: layout and tabs only. Form, cards, dialogs and data access live in components/timeoff/. */
const TimeOffPage = () => {
  const { user, effectiveRole, displayName } = useAuth();
  const { can } = useAccess();
  const isAdmin = can("timeOff.approve");
  const notice = noticeFor(effectiveRole);
  const { items, loading, reload } = useTimeOffRequests();
  const [tab, setTab] = useState<string>(isAdmin ? "approvals" : "mine");

  const myItems = useMemo(() => items.filter((r) => r.user_id === user?.id), [items, user?.id]);
  const pending = useMemo(() => items.filter((r) => r.status === "pending"), [items]);
  const approved = useMemo(() => items.filter((r) => r.status === "approved"), [items]);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-6">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Home
        </Link>

        <div className="mt-4 flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl uppercase tracking-wide flex items-center gap-2">
              <Palmtree className="h-6 w-6 text-primary" /> Time Off
            </h1>
            <p className="text-sm text-muted-foreground">Request days off — admin approves and the team is notified.</p>
          </div>
          <RequestFormDialog userId={user?.id} displayName={displayName} notice={notice} onSubmitted={reload} />
        </div>

        <Tabs value={tab} onValueChange={setTab} className="mt-5">
          <TabsList className={cn("grid w-full", isAdmin ? "grid-cols-3" : "grid-cols-1")}>
            {isAdmin && (
              <TabsTrigger value="approvals">
                Approvals {pending.length > 0 && <span className="ml-1 rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">{pending.length}</span>}
              </TabsTrigger>
            )}
            <TabsTrigger value="mine">My Requests</TabsTrigger>
            {isAdmin && <TabsTrigger value="approved">Approved</TabsTrigger>}
          </TabsList>

          {isAdmin && (
            <TabsContent value="approvals" className="mt-4 space-y-2">
              <ApprovalsTab
                items={items}
                pending={pending}
                loading={loading}
                deciderId={user?.id}
                deciderName={displayName}
                onChanged={reload}
              />
            </TabsContent>
          )}

          <TabsContent value="mine" className="mt-4 space-y-2">
            <MyRequestsTab items={myItems} loading={loading} onChanged={reload} />
          </TabsContent>

          {isAdmin && (
            <TabsContent value="approved" className="mt-4 space-y-2">
              <ApprovedTab approved={approved} loading={loading} />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
};

export default TimeOffPage;
