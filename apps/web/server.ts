import handler from "./dist/server/server.js"

const port = Number(process.env.PORT ?? 3000)
const staticRoots = [`${import.meta.dir}/dist/client`, `${import.meta.dir}/dist`]
const contentTypes: Record<string, string> = {
  css: "text/css; charset=utf-8",
  ico: "image/x-icon",
  jfif: "image/jpeg",
  js: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  png: "image/png",
  svg: "image/svg+xml",
}

async function serveStatic(url: URL) {
  const pathname = decodeURIComponent(url.pathname)

  if (pathname.includes("..")) {
    return undefined
  }

  if (pathname === "/favicon.ico") {
    const file = Bun.file(`${import.meta.dir}/favicon.ico`)

    if (await file.exists()) {
      return new Response(file, {
        headers: {
          "Cache-Control": "public, max-age=86400",
          "Content-Type": contentTypes.ico,
        },
      })
    }
  }

  for (const root of staticRoots) {
    const file = Bun.file(`${root}${pathname}`)

    if (await file.exists()) {
      const extension = pathname.split(".").pop() ?? ""

      return new Response(file, {
        headers: {
          "Cache-Control": pathname.startsWith("/assets/")
            ? "public, max-age=31536000, immutable"
            : "public, max-age=3600",
          "Content-Type": contentTypes[extension] ?? file.type,
        },
      })
    }
  }

  return undefined
}

Bun.serve({
  port,
  async fetch(req) {
    const staticResponse = await serveStatic(new URL(req.url))

    if (staticResponse) {
      return staticResponse
    }

    return handler.fetch(req)
  },
})

console.log(`web listening on :${port}`)
