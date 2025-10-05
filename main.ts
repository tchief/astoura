import { serveFile } from "jsr:@std/http/file-server";

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  if (url.pathname.startsWith("/static/")) {
    return await serveFile(req, `.${url.pathname}`);
  }

  return serveFile(req, "./index.html");
});