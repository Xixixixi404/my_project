const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const host = "0.0.0.0";
const port = 4173;
const root = __dirname;

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

http.createServer((req, res) => {
  const requestPath = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  const resolvedPath = path.join(root, decodeURIComponent(requestPath));

  if (!resolvedPath.startsWith(root)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(resolvedPath, (error, content) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const contentType = mimeTypes[path.extname(resolvedPath)] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    res.end(content);
  });
}).listen(port, host, () => {
  console.log(`Serving http://${host}:${port}`);
});
