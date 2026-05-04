import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "@/lib/utils";

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => {
  const indeterminate = value === undefined || value === null;
  return (
    <ProgressPrimitive.Root
      ref={ref}
      value={indeterminate ? undefined : value}
      className={cn("relative h-4 w-full overflow-hidden rounded-full bg-secondary", className)}
      {...props}
    >
      {indeterminate ? (
        <div className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-primary animate-progress-indeterminate" />
      ) : (
        <ProgressPrimitive.Indicator
          className="h-full w-full flex-1 bg-primary transition-all"
          style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
        />
      )}
    </ProgressPrimitive.Root>
  );
});
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
