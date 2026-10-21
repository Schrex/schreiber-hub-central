import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { classifyTalkMedia } from '@/lib/talkMedia';

export function TalkMedia({ value, kind, title, className }: {
  value: string; kind: 'image' | 'video'; title: string; className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setUrl(null);
    setFailed(false);
    const media = classifyTalkMedia(value, import.meta.env.VITE_SUPABASE_URL);
    const resolve = async () => {
      if (media.kind === 'external') { if (active) setUrl(media.url); return; }
      if (media.kind === 'unavailable') { if (active) setFailed(true); return; }
      try {
        const { data, error } = await supabase.storage.from('talk-media').createSignedUrl(media.path, 600);
        if (active) {
          setUrl(error ? null : data?.signedUrl ?? null);
          setFailed(Boolean(error || !data?.signedUrl));
        }
      } catch { if (active) { setUrl(null); setFailed(true); } }
    };
    void resolve();
    const refresh = setInterval(() => void resolve(), 8 * 60 * 1000);
    return () => { active = false; clearInterval(refresh); };
  }, [value]);
  if (failed) return <p className="text-sm text-muted-foreground">Media unavailable. Check your access or reload to retry.</p>;
  if (!url) return <p className="text-sm text-muted-foreground">Loading media…</p>;
  return kind === 'image'
    ? <img src={url} alt={title} loading="lazy" className={className} />
    : <video src={url} controls className={className} />;
}
