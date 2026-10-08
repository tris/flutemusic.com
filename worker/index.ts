// The site's one piece of server code, for its MP3s. Cloudflare serves every file
// itself, but always whole: it ignores a Range header asking for part of a file.
// Safari won't play audio from a server that does that, so wrangler.jsonc sends
// requests for MP3s here, and this answers the Range header itself.

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const response = await env.ASSETS.fetch(request);
    if (response.status !== 200) return response;

    const headers = new Headers(response.headers);
    headers.set('Accept-Ranges', 'bytes');
    const range = request.headers.get('Range')?.match(/^bytes=(\d*)-(\d*)$/);
    // An If-Range naming an older copy of the file asks for all of the new one.
    const ifRange = request.headers.get('If-Range');
    if (!range || !response.body || (ifRange && ifRange !== response.headers.get('ETag'))) {
      return new Response(response.body, { headers });
    }

    // Cloudflare's response doesn't give the file's length, so read all of it. The
    // MP3s are a few megabytes at most.
    const file = await response.arrayBuffer();
    const size = file.byteLength;
    headers.delete('Content-Length');
    const bytes = byteRange(range[1], range[2], size);
    if (!bytes) return new Response(file, { headers });
    if (bytes === 'unsatisfiable') {
      headers.set('Content-Range', `bytes */${size}`);
      return new Response(null, { status: 416, headers });
    }
    const [start, end] = bytes;
    headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
    return new Response(file.slice(start, end + 1), { status: 206, headers });
  },
};

// The first and last byte that bytes=first-last asks for, or undefined to send the
// whole file, as for a range that ends before it starts.
function byteRange(first: string, last: string, size: number): [number, number] | 'unsatisfiable' | undefined {
  if (first === '') {
    // bytes=-500 asks for the last 500 bytes.
    if (last === '') return;
    if (Number(last) === 0) return 'unsatisfiable';
    return [Math.max(size - Number(last), 0), size - 1];
  }
  const start = Number(first);
  if (last !== '' && Number(last) < start) return;
  if (start >= size) return 'unsatisfiable';
  return [start, last === '' ? size - 1 : Math.min(Number(last), size - 1)];
}
