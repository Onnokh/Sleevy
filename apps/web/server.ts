import handler from "./dist/server/server.js"

const port = Number(process.env.PORT ?? 3000)

Bun.serve({
  port,
  fetch(req) {
    return handler.fetch(req)
  },
})

console.log(`web listening on :${port}`)
