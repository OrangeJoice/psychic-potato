const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");

const app = express();

const SUBDOMAINS = {
  "bloxd.io": "https://bloxd.io",
  "assets.bloxd.io": "https://assets.bloxd.io",
  "server.bloxd.io": "https://server.bloxd.io"
};

// Only rewrite HTML, never JS
function rewriteHTML(proxyRes, req, res) {
  let body = Buffer.from([]);

  proxyRes.on("data", chunk => {
    body = Buffer.concat([body, chunk]);
  });

  proxyRes.on("end", () => {
    let text = body.toString("utf8");

    const proxyBase = `${req.protocol}://${req.get("host")}`;

    Object.keys(SUBDOMAINS).forEach(sub => {
      const real = `https://${sub}`;
      const fake = `${proxyBase}/__${sub}`;
      text = text.replaceAll(real, fake);
    });

    res.setHeader("content-type", "text/html");
    res.send(text);
  });
}

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
      const type = proxyRes.headers["content-type"] || "";

      // Only rewrite HTML
      if (type.includes("text/html")) {
        rewriteHTML(proxyRes, req, res);
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
  console.log("Safe Bloxd proxy running on port", PORT);
});
