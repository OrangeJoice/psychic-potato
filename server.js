const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");

const app = express();

const SUBDOMAINS = {
  "bloxd.io": "https://bloxd.io",
  "assets.bloxd.io": "https://assets.bloxd.io",
  "server.bloxd.io": "https://server.bloxd.io"
};

// Rewrites URLs inside text-based responses
function rewriteBody(proxyRes, req, res) {
  let body = Buffer.from([]);

  proxyRes.on("data", chunk => {
    body = Buffer.concat([body, chunk]);
  });

  proxyRes.on("end", () => {
    let text = body.toString("utf8");

    const proxyBase = `${req.protocol}://${req.get("host")}`;

    // Rewrite all Bloxd URLs → proxy URLs
    Object.keys(SUBDOMAINS).forEach(sub => {
      const real = `https://${sub}`;
      const fake = `${proxyBase}/__${sub}`;
      text = text.replaceAll(real, fake);
    });

    res.send(text);
  });
}

// Build proxy with rewrite support
function makeProxy(target) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    ws: true,
    selfHandleResponse: true,
    onProxyReq: (proxyReq) => {
      proxyReq.setHeader("Host", new URL(target).host);
    },
    onProxyRes: (proxyRes, req, res) => {
      const contentType = proxyRes.headers["content-type"] || "";

      // Only rewrite text-based content
      if (contentType.includes("text") || contentType.includes("javascript")) {
        rewriteBody(proxyRes, req, res);
      } else {
        proxyRes.pipe(res);
      }
    }
  });
}

// Subdomain routing
Object.entries(SUBDOMAINS).forEach(([sub, target]) => {
  app.use(`/__${sub}/`, (req, res, next) => {
    req.url = req.url.replace(`/__${sub}`, "");
    makeProxy(target)(req, res, next);
  });
});

// Default route → main site
app.use("/", makeProxy("https://bloxd.io"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Auto‑rewrite Bloxd proxy running on port", PORT);
});
