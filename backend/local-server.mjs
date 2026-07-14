// Adapter gia lap Lambda Function URL cho local. Chi file nay khac AWS thuc
// te (vi Function URL tren AWS tu dong lo phan HTTP server + CORS preflight).
// Logic nghiep vu 100% nam trong src/handler.mjs.
import http from "node:http";
import { handler } from "./src/handler.mjs";
import { ensureTableExists } from "./src/ensure-table.mjs";

const PORT = process.env.PORT || 3000;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  // AWS Function URL tu xu ly preflight OPTIONS khi bat CORS (muc 3.5) —
  // o local ta phai tu lam dieu nay.
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  try {
    const body = req.method === "POST" ? await readBody(req) : undefined;
    const url = new URL(req.url, `http://${req.headers.host}`);

    const event = {
      requestContext: { http: { method: req.method } },
      rawPath: url.pathname,
      headers: {
        ...req.headers,
        "x-forwarded-proto": "http",
      },
      body,
    };

    const result = await handler(event);

    res.writeHead(result.statusCode, { ...CORS_HEADERS, ...result.headers });
    res.end(result.body || "");
  } catch (err) {
    console.error("Loi xu ly request:", err);
    res.writeHead(500, { ...CORS_HEADERS, "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Lỗi server nội bộ." }));
  }
});

ensureTableExists()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Local Lambda simulator dang chay tai http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Khong the khoi tao bang DynamoDB Local:", err);
    process.exit(1);
  });
