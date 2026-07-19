const net = require('node:net')

function parsePort(value) {
  const port = Number.parseInt(String(value ?? ''), 10)
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : null
}

function isPortAvailable(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const server = net.createServer()

    server.unref()
    server.on('error', () => resolve(false))
    server.listen({ host, port }, () => {
      server.close(() => resolve(true))
    })
  })
}

async function findAvailablePort(preferredPort, { host = '127.0.0.1', fallbackStart = 8000, fallbackEnd = 8999 } = {}) {
  const requestedPort = parsePort(preferredPort)

  if (requestedPort && (await isPortAvailable(requestedPort, host))) {
    return requestedPort
  }

  for (let port = fallbackStart; port <= fallbackEnd; port += 1) {
    if (port === requestedPort) continue
    if (await isPortAvailable(port, host)) {
      return port
    }
  }

  throw new Error(`Unable to find a free port on ${host}.`)
}

module.exports = {
  findAvailablePort,
}