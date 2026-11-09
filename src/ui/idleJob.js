// Run a resumable job (see createPreflightJob) in slices, in the gaps between rendered frames.

const MIN_SLICE_MS = 4;
const MAX_SLICE_MS = 8;

// Safari has no requestIdleCallback; there, take one slice per 60 Hz frame so frames keep most of the thread.
const nextSlice = (fn) =>
  typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, { timeout: 100 }) : setTimeout(fn, 16);

/**
 * Advance `job` during idle time and call onDone() once it finishes.
 * Returns a cancel function; after it is called, onDone never fires.
 */
export function runWhenIdle(job, onDone) {
  let cancelled = false;
  const slice = (deadline) => {
    if (cancelled) return;
    // A busy page can give an idle callback 0 ms left (or fire it on timeout), so a floor keeps the job moving.
    const budget = Math.min(MAX_SLICE_MS, Math.max(MIN_SLICE_MS, deadline?.timeRemaining?.() ?? 0));
    const end = performance.now() + budget;
    if (job.run(() => performance.now() < end)) onDone();
    else nextSlice(slice);
  };
  nextSlice(slice);
  return () => {
    cancelled = true;
  };
}
