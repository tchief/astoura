import { serveFile } from "jsr:@std/http/file-server";

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  if (url.pathname === "/repo") {
    return Response.redirect("https://github.com/tchief/astoura/tree/al-deno", 302);
  }

  if (url.pathname === "/pr") {
    return Response.redirect("https://github.com/tchief/aladin-lite/tree/feat/tour", 302);
  }

  if (url.pathname === "/demo") {
    return await serveFile(req, "./demo.html");
  }

  if (url.pathname === "/yt") {
    return Response.redirect("https://youtu.be/qXsXQAAOaPU", 302);
  }

  if (url.pathname.startsWith("/static/")) {
    return await serveFile(req, `.${url.pathname}`);
  }

  return serveFile(req, "./index.html");
});