import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function JobDetailTabs({
  lookahead,
  jobInfo,
  files,
  field,
}: {
  lookahead: ReactNode;
  jobInfo: ReactNode;
  files: ReactNode;
  field: ReactNode;
}) {
  return (
    <Tabs defaultValue="lookahead" className="w-full">
      <TabsList className="grid h-auto w-full grid-cols-4 gap-0.5" data-testid="job-detail-tabs">
        <TabsTrigger value="lookahead" className="min-h-11 px-1 text-xs sm:text-sm">
          Look-ahead
        </TabsTrigger>
        <TabsTrigger value="info" className="min-h-11 px-1 text-xs sm:text-sm">
          Job info
        </TabsTrigger>
        <TabsTrigger value="files" className="min-h-11 px-1 text-xs sm:text-sm">
          Files
        </TabsTrigger>
        <TabsTrigger value="field" className="min-h-11 px-1 text-xs sm:text-sm">
          Field
        </TabsTrigger>
      </TabsList>
      <TabsContent value="lookahead" className="mt-4 space-y-5">
        {lookahead}
      </TabsContent>
      <TabsContent value="info" className="mt-4 space-y-5">
        {jobInfo}
      </TabsContent>
      <TabsContent value="files" className="mt-4 space-y-5">
        {files}
      </TabsContent>
      <TabsContent value="field" className="mt-4 space-y-5">
        {field}
      </TabsContent>
    </Tabs>
  );
}
