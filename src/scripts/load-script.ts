// Loads classic scripts such as jQuery and its plugins, each once per visit to the
// site: the client router keeps the page's JavaScript between pages, so jQuery
// loaded on /schedule/ is still there on /listen/.
const loaded = new Map<string, Promise<void>>();

function loadScript(src: string): Promise<void> {
  let promise = loaded.get(src);
  if (!promise) {
    promise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      // Download in parallel, but run in the order they were asked for.
      script.async = false;
      // Tells the client router that this script has run, so it never runs it again.
      script.dataset.astroExec = '';
      script.onload = () => resolve();
      script.onerror = () => {
        loaded.delete(src);
        reject(new Error(`Couldn't load ${src}`));
      };
      document.head.append(script);
    });
    loaded.set(src, promise);
  }
  return promise;
}

export async function loadScripts(srcs: string[]): Promise<void> {
  await Promise.all(srcs.map(loadScript));
}
