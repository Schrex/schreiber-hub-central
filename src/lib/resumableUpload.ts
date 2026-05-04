import * as tus from "tus-js-client";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

interface UploadOpts {
  bucket: string;
  path: string;
  file: File;
  contentType?: string;
  upsert?: boolean;
  onProgress?: (pct: number) => void;
}

/**
 * Upload a file to Supabase Storage using the TUS resumable protocol.
 * Required for files larger than ~6 MB or flaky networks.
 */
export const resumableUpload = async ({
  bucket,
  path,
  file,
  contentType,
  upsert = false,
  onProgress,
}: UploadOpts): Promise<void> => {
  const { data: sess } = await supabase.auth.getSession();
  const accessToken = sess.session?.access_token;
  if (!accessToken) throw new Error("You must be signed in to upload.");

  await new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: `${SUPABASE_URL}/storage/v1/upload/resumable`,
      retryDelays: [0, 1000, 3000, 5000, 10000],
      headers: {
        authorization: `Bearer ${accessToken}`,
        "x-upsert": upsert ? "true" : "false",
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: bucket,
        objectName: path,
        contentType: contentType || file.type || "application/octet-stream",
        cacheControl: "3600",
      },
      chunkSize: 6 * 1024 * 1024, // Supabase requires exactly 6MB chunks
      onError: (err) => reject(err),
      onProgress: (sent, total) => {
        if (onProgress && total) onProgress(Math.round((sent / total) * 100));
      },
      onSuccess: () => resolve(),
    });

    upload.findPreviousUploads().then((prev) => {
      if (prev.length) upload.resumeFromPreviousUpload(prev[0]);
      upload.start();
    });
  });
};
