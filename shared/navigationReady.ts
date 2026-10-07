type Navigation = { isReady: () => boolean };
type Scheduler = {
  schedule: (callback: () => void) => unknown;
  cancel: (handle: unknown) => void;
};

const timerScheduler: Scheduler = {
  schedule: (callback) => setTimeout(callback, 16),
  cancel: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/** Wait outside render for a mounted navigator, then perform one action. */
export function runWhenNavigationReady(
  navigation: Navigation,
  action: () => void,
  scheduler: Scheduler = timerScheduler
) {
  let stopped = false;
  let handle: unknown;
  const check = () => {
    if (stopped) return;
    if (!navigation.isReady()) {
      handle = scheduler.schedule(check);
      return;
    }
    stopped = true;
    action();
  };
  handle = scheduler.schedule(check);
  return () => {
    stopped = true;
    scheduler.cancel(handle);
  };
}
