const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");

const app = express();

// List of Bloxd subdomains you want to support
const targets = {
  "bloxd.io": "https://bloxd.io",
  "assets.bloxd.io": "https://assets.bloxd.io",
  "server.bloxd.io": "https://server.bloxd.io"
};

// Generic proxy builder
function buildProxy(target) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    ws: true,
    secure: true,
    onProxyReq: (proxyReq) => {
      proxyReq.setHeader("Host", new URL(target).host);
    },
    onError: (err, req, res) => {
      console.error("Proxy error:", err.message);
      if (!res.headersSent) {
        res.writeHead(502, { "Content-Type": "text/plain" });
      }
      res.end("Proxy error");
    }
  });
}

// Route each subdomain to its target
Object.entries(targets).forEach(([subdomain, target]) => {
  app.use(`/__${subdomain}/`, (req, res, next) => {
    req.url = req.url.replace(`/__${subdomain}`, "");
    buildProxy(target)(req, res, next);
  });
});

// Default: main site
app.use("/", buildProxy("https://bloxd.io"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Proxy running on port ${PORT}`);
});
