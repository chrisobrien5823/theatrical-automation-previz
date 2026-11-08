import { describe, it, expect } from 'vitest';
import demo from '../src/shows/demo.json';
import { loadShow } from '../src/core/show.js';
import { preflightShow, createPreflightJob } from '../src/core/preflight.js';
import { runWhenIdle } from '../src/ui/idleJob.js';

const { show } = loadShow(demo);
const home = Object.fromEntries(show.axes.map((a) => [a.id, a.home]));

describe('createPreflightJob', () => {
  it('gives exactly what preflightShow gives, however it is sliced', () => {
    const expected = preflightShow(show, home, 0);
    for (const stepsPerSlice of [1, 7, 1000]) {
      const job = createPreflightJob(show, home, 0);
      let left;
      const hasTime = () => --left > 0;
      let slices = 0;
      do {
        left = stepsPerSlice;
        slices++;
      } while (!job.run(hasTime));
      expect(job.done).toBe(true);
      expect(job.results).toEqual(expected);
      if (stepsPerSlice === 1) expect(slices).toBeGreaterThan(100); // really was cut into pieces
    }
  });

  it('still flags only Q3 when run as a job', () => {
    const job = createPreflightJob(show, home, 0);
    job.run();
    const flagged = job.results.filter((r) => r.conflicts.length).map((r) => r.cueId);
    expect(flagged).toEqual(['3']);
  });

  it('always advances at least one step, so a job can never stall', () => {
    const job = createPreflightJob(show, home, 0);
    let runs = 0;
    while (!job.run(() => false)) runs++;
    expect(runs).toBeGreaterThan(0);
    expect(job.results).toHaveLength(show.cues.length);
  });

  it('keeps null for cues before the starting index', () => {
    const job = createPreflightJob(show, home, 2);
    job.run();
    expect(job.results[0]).toBeNull();
    expect(job.results[1]).toBeNull();
    expect(job.results[2].cueId).toBe(show.cues[2].id);
  });

  it('does not change once finished', () => {
    const job = createPreflightJob(show, home, 0);
    job.run();
    const first = job.results;
    expect(job.run()).toBe(true);
    expect(job.results).toBe(first);
  });
});

describe('runWhenIdle', () => {
  const fakeJob = (slicesNeeded) => ({
    slices: 0,
    run() {
      return ++this.slices >= slicesNeeded;
    },
  });
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const until = async (test) => {
    for (let waited = 0; !test() && waited < 2000; waited += 10) await wait(10);
  };

  it('runs a job to the end across slices, then calls onDone once', async () => {
    const job = fakeJob(3);
    let done = 0;
    runWhenIdle(job, () => done++);
    expect(job.slices).toBe(0); // nothing runs on the caller's frame
    await until(() => done > 0);
    await wait(50); // a stray extra slice would show up here
    expect(job.slices).toBe(3);
    expect(done).toBe(1);
  });

  it('never calls onDone after being cancelled', async () => {
    const job = fakeJob(3);
    let done = 0;
    const cancel = runWhenIdle(job, () => done++);
    await wait(25); // let it start
    cancel();
    const slicesAtCancel = job.slices;
    await wait(120);
    expect(job.slices).toBe(slicesAtCancel);
    expect(done).toBe(0);
  });
});
