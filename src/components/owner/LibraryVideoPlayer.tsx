import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { libraryVideoPlaybackUrl, listLibraryVideoIndex } from "@/lib/library-video.functions";
import { msUntilRefresh } from "@/lib/library-video";

/** Presentational player: controls, inline on iPhone, metadata only until play, never autoplay. */
export function VideoElement({
  src, poster, mime, label, videoRef, onError, onLoadedMetadata,
}: {
  src: string;
  poster?: string;
  mime?: string;
  label: string;
  videoRef?: React.Ref<HTMLVideoElement>;
  onError?: () => void;
  onLoadedMetadata?: () => void;
}) {
  return (
    <video
      ref={videoRef}
      controls
      playsInline
      preload="metadata"
      poster={poster}
      aria-label={label}
      className="aspect-video w-full rounded-lg border border-border bg-muted"
      onError={onError}
      onLoadedMetadata={onLoadedMetadata}
    >
      <source src={src} type={mime === "video/quicktime" ? "video/mp4" : mime} />
    </video>
  );
}

/** Which library items have a video this person may watch. */
export function useLibraryVideoIndex() {
  const list = useServerFn(listLibraryVideoIndex);
  const q = useQuery({ queryKey: ["library-video-index"], queryFn: () => list(), staleTime: 60_000 });
  return new Map((q.data ?? []).map((v) => [v.libraryId, v]));
}

/**
 * Plays the current video of a library item. The link is short-lived: it is renewed
 * shortly before it runs out, and again if playback fails, resuming where it stopped.
 */
export function LibraryVideoPlayer({ libraryId, poster, label }: { libraryId: string; poster?: string; label: string }) {
  const get = useServerFn(libraryVideoPlaybackUrl);
  const qc = useQueryClient();
  const key = ["library-video-url", libraryId];
  const q = useQuery({ queryKey: key, queryFn: () => get({ data: { libraryId } }), staleTime: Infinity, retry: 1 });
  const ref = useRef<HTMLVideoElement | null>(null);
  const resumeAt = useRef(0);
  const wasPlaying = useRef(false);

  useEffect(() => {
    if (!q.data) return;
    const t = setTimeout(() => {
      // Swap links only while paused so playback isn't interrupted; a failure mid-play is handled by onError.
      if (!ref.current || ref.current.paused) refresh();
    }, msUntilRefresh(q.data.expiresAt, Date.now()));
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data?.expiresAt]);

  function refresh() {
    if (ref.current) { resumeAt.current = ref.current.currentTime; wasPlaying.current = !ref.current.paused; }
    void qc.invalidateQueries({ queryKey: key });
  }

  if (q.isLoading) return <div className="aspect-video w-full animate-pulse rounded-lg bg-muted" aria-label="Loading video" />;
  if (q.error || !q.data) {
    return <p className="rounded-lg border border-border p-3 text-sm text-muted-foreground">{q.error instanceof Error ? q.error.message : "The video could not be loaded."}</p>;
  }
  return (
    <VideoElement
      key={q.data.url}
      src={q.data.url}
      mime={q.data.mime}
      {...(poster ? { poster } : {})}
      label={label}
      videoRef={ref}
      onError={() => { if (Date.now() > q.data!.expiresAt - 5 * 60_000) refresh(); }}
      onLoadedMetadata={() => {
        const v = ref.current;
        if (v && resumeAt.current > 0) {
          v.currentTime = resumeAt.current;
          resumeAt.current = 0;
          if (wasPlaying.current) void v.play().catch(() => undefined);
        }
      }}
    />
  );
}
