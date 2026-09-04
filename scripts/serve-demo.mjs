import { createReadStream } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const root = join(process.cwd(), "dist-site");
const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"]
]);

createServer((request, response) => {
  const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
  const relative = pathname === "/" ? "index.html" : normalize(pathname).replace(/^\/+/, "");
  const file = join(root, relative);
  if (!file.startsWith(root)) {
    response.writeHead(403).end();
    return;
  }
  const stream = createReadStream(file);
  stream.once("error", () => response.writeHead(404).end());
  response.setHeader("Content-Type", contentTypes.get(extname(file)) ?? "application/octet-stream");
  stream.pipe(response);
}).listen(4173, "127.0.0.1");
