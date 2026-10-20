export function connectDemoFrame() {
  const controller = new AbortController();
  window.addEventListener(
    'message',
    (event) => {
      if (
        event.origin !== location.origin ||
        event.source !== parent ||
        event.data?.type !== 'demo:theme'
      )
        return;
      document.documentElement.dataset.theme =
        event.data.theme === 'dark' ? 'dark' : 'light';
    },
    { signal: controller.signal },
  );
  const observer = new ResizeObserver(() => {
    if (parent !== window)
      parent.postMessage(
        { type: 'demo:resize', height: document.body.scrollHeight + 4 },
        location.origin,
      );
  });
  observer.observe(document.body);
  window.addEventListener(
    'pagehide',
    () => {
      controller.abort();
      observer.disconnect();
    },
    { once: true },
  );
}
