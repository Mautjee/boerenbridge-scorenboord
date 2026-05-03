import { createServer } from 'node:http'
import server from './dist/server/server.js'

const PORT = process.env.PORT || 3000

const nodeServer = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`)
  
  const headers = new Headers()
  for (const [key, values] of Object.entries(req.headers)) {
    if (values === undefined) continue
    if (Array.isArray(values)) {
      for (const value of values) {
        headers.append(key, value)
      }
    } else {
      headers.set(key, values)
    }
  }

  let body = undefined
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const chunks = []
    for await (const chunk of req) {
      chunks.push(chunk)
    }
    body = Buffer.concat(chunks)
  }

  const request = new Request(url, {
    method: req.method,
    headers,
    body,
  })

  try {
    const response = await server.fetch(request)
    res.statusCode = response.status
    res.statusMessage = response.statusText
    
    for (const [key, value] of response.headers) {
      res.setHeader(key, value)
    }

    if (response.body) {
      const reader = response.body.getReader()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        res.write(value)
      }
    }
    res.end()
  } catch (err) {
    console.error('Request error:', err)
    res.statusCode = 500
    res.end('Internal Server Error')
  }
})

nodeServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`)
})
