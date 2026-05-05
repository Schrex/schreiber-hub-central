import { useCallback, useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileDropZoneProps {
  onFiles: (files: File[]) => void;
  /** Optional accept filter, e.g. "image/*,application/pdf" */
  accept?: string;
  /** Allow multiple files (default true) */
  multiple?: boolean;
  /** Disable dropping */
  disabled?: boolean;
  /** Custom label shown on the overlay */
  label?: string;
  className?: string;
  children: React.ReactNode;
}

const matchesAccept = (file: File, accept?: string) => {
  if (!accept) return true;
  const tokens = accept.split(",").map((t) => t.trim().toLowerCase());
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return tokens.some((t) => {
    if (!t) return false;
    if (t.startsWith(".")) return name.endsWith(t);
    if (t.endsWith("/*")) return type.startsWith(t.slice(0, -1));
    return type === t;
  });
};

/**
 * Wraps any region to accept drag-and-drop file uploads.
 * Shows a dashed overlay while dragging, then forwards filtered files
 * (single or multi) to onFiles. Works on top of existing upload UI.
 */
export const FileDropZone = ({
  onFiles,
  accept,
  multiple = true,
  disabled = false,
  label = "Drop files to upload",
  className,
  children,
}: FileDropZoneProps) => {
  const [over, setOver] = useState(false);
  const counter = useRef(0);

  const handleEnter = useCallback(
    (e: React.DragEvent) => {
      if (disabled) return;
      if (!Array.from(e.dataTransfer.types || []).includes("Files")) return;
      e.preventDefault();
      counter.current += 1;
      setOver(true);
    },
    [disabled],
  );
  const handleLeave = useCallback((e: React.DragEvent) => {
    if (disabled) return;
    e.preventDefault();
    counter.current = Math.max(0, counter.current - 1);
    if (counter.current === 0) setOver(false);
  }, [disabled]);
  const handleOver = useCallback((e: React.DragEvent) => {
    if (disabled) return;
    if (!Array.from(e.dataTransfer.types || []).includes("Files")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, [disabled]);
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      if (disabled) return;
      e.preventDefault();
      counter.current = 0;
      setOver(false);
      const all = Array.from(e.dataTransfer.files ?? []);
      let files = all.filter((f) => matchesAccept(f, accept));
      if (!multiple) files = files.slice(0, 1);
      if (files.length) onFiles(files);
    },
    [accept, disabled, multiple, onFiles],
  );

  return (
    <div
      className={cn("relative", className)}
      onDragEnter={handleEnter}
      onDragLeave={handleLeave}
      onDragOver={handleOver}
      onDrop={handleDrop}
    >
      {children}
      {over && (
        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-primary bg-primary/10 backdrop-blur-sm">
          <UploadCloud className="h-6 w-6 text-primary" />
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            {label}
          </p>
        </div>
      )}
    </div>
  );
};
