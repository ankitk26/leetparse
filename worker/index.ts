import { Hono } from "hono";
import { generateCppFromUrl } from "./leetcode";

const app = new Hono();

app.get("/api/health", (c) => c.json({ status: "ok" }));

app.post("/api/generate", async (c) => {
  try {
    const body = await c.req.json<{ url?: string }>();
    const url = body.url?.trim();

    if (!url) {
      return c.json({ error: "URL is required." }, 400);
    }

    const code = await generateCppFromUrl(url);
    return c.json({ code });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return c.json({ error: message }, 400);
  }
});

export default app;
