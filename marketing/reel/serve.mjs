// Serves the reel page on 127.0.0.1:4180 and saves the rendered video it POSTs to /save.
import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mp4": "video/mp4", ".webm": "video/webm" };

createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (req.method === "POST" && url.pathname === "/save") {
    const ext = url.searchParams.get("name") === "webm" ? "webm" : "mp4";
    const file = /^[a-z0-9-]{1,40}$/.test(url.searchParams.get("file") ?? "") ? url.searchParams.get("file") : "sora-reel";
    const name = `${file}.${ext}`;
    const chunks = [];
    for await (const c of req) chunks.push(c);
    await writeFile(join(root, name), Buffer.concat(chunks));
    res.end(`saved ${name}`);
    return;
  }
  const path = normalize(join(root, url.pathname === "/" ? "reel.html" : url.pathname));
  if (!path.startsWith(root)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(path), type = types[extname(path)] ?? "application/octet-stream";
    // byte ranges, so a browser can seek in the video
    const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? "");
    if (range) {
      const start = Number(range[1] || 0), end = range[2] ? Number(range[2]) : body.length - 1;
      res.writeHead(206, { "content-type": type, "accept-ranges": "bytes", "content-range": `bytes ${start}-${end}/${body.length}`, "content-length": end - start + 1 }).end(body.subarray(start, end + 1));
      return;
    }
    res.writeHead(200, { "content-type": type, "accept-ranges": "bytes" }).end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
}).listen(4180, "127.0.0.1", () => console.log("reel on http://127.0.0.1:4180"));
