const { spawn } = require('node:child_process')

const processes = []

function run(name, command, args) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    shell: true,
    stdio: 'inherit',
    env: {
      ...process.env,
      VITE_PREDICTION_API_URL: process.env.VITE_PREDICTION_API_URL || 'http://127.0.0.1:8001'
    }
  })

  child.on('exit', (code) => {
    if (code && code !== 0) {
      console.error(`${name} exited with code ${code}`)
    }
  })

  processes.push(child)
  return child
}

function shutdown() {
  for (const child of processes) {
    if (!child.killed) child.kill()
  }
}

process.on('SIGINT', () => {
  shutdown()
  process.exit(0)
})

process.on('SIGTERM', () => {
  shutdown()
  process.exit(0)
})

run('backend', 'python', [
  '-m',
  'uvicorn',
  'backend.app:app',
  '--host',
  '127.0.0.1',
  '--port',
  '8001'
])

run('frontend', 'vite', ['--host', '127.0.0.1'])
