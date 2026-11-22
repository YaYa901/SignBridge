#!/usr/bin/env node
// Cross-platform helper (Windows / macOS / Linux). Usage: node scripts/run.mjs <command>
//   setup  create .venv, install Python + npm deps, create backend/.env
//   dev    run API (:8000) and web (:5173) together     api | web   run one of them
//   build  production build of the frontend             start       build + serve everything from the API on :8000
//   test   run backend tests
import { spawn, spawnSync } from 'node:child_process'
import { copyFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const backend = join(root, 'backend')
const frontend = join(root, 'frontend')
const isWin = process.platform === 'win32'
const venvPy = isWin ? join(root, '.venv', 'Scripts', 'python.exe') : join(root, '.venv', 'bin', 'python')
const npm = isWin ? 'npm.cmd' : 'npm'

const fail = message => { console.error(`\n✖ ${message}\n`); process.exit(1) }
const run = (cmd, args, options = {}) => {
  const result = spawnSync(cmd, args, { stdio: 'inherit', shell: isWin && cmd === npm, ...options })
  if (result.error) fail(`Could not run "${cmd}": ${result.error.message}`)
  if (result.status !== 0) fail(`"${[cmd, ...args].join(' ')}" failed (exit ${result.status}).`)
}

function findPython() {
  const candidates = isWin ? [['py', '-3'], ['python'], ['python3']] : [['python3'], ['python']]
  for (const [cmd, ...pre] of candidates) {
    const probe = spawnSync(cmd, [...pre, '-c', 'import sys; print(sys.version_info >= (3, 10))'], { encoding: 'utf8' })
    if (probe.status === 0 && probe.stdout.trim() === 'True') return [cmd, ...pre]
  }
  return fail('Python 3.10+ was not found. Install it from https://www.python.org/downloads/ and re-run.')
}

function requireVenv() {
  if (!existsSync(venvPy)) fail('The Python environment is missing. Run:  npm run setup')
}
function requireWebDeps() {
  if (!existsSync(join(frontend, 'node_modules'))) fail('Frontend dependencies are missing. Run:  npm run setup')
}

function setup() {
  const [py, ...pre] = findPython()
  if (!existsSync(venvPy)) run(py, [...pre, '-m', 'venv', join(root, '.venv')])
  run(venvPy, ['-m', 'pip', 'install', '-r', join(backend, 'requirements.txt')])
  const env = join(backend, '.env')
  if (!existsSync(env)) { copyFileSync(join(backend, '.env.example'), env); console.log('Created backend/.env from .env.example') }
  run(npm, ['ci'], { cwd: frontend })
  console.log('\n✔ Setup complete. Start everything with:  npm run dev\n  App: http://localhost:5173   API docs: http://localhost:8000/docs\n')
}

const apiArgs = reload => ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', '8000', ...(reload ? ['--reload'] : [])]

function longRunning(jobs) {
  const children = jobs.map(([name, cmd, args, cwd]) => {
    const child = spawn(cmd, args, { cwd, stdio: 'inherit', shell: isWin && cmd === npm })
    child.on('exit', code => { console.log(`[${name}] exited (${code})`); stop(code ?? 0) })
    return child
  })
  let stopping = false
  function stop(code) {
    if (stopping) return
    stopping = true
    children.forEach(child => { try { child.kill() } catch { /* already gone */ } })
    setTimeout(() => process.exit(code), 300)
  }
  process.on('SIGINT', () => stop(0))
  process.on('SIGTERM', () => stop(0))
}

const commands = {
  setup,
  dev() { requireVenv(); requireWebDeps(); longRunning([['api', venvPy, apiArgs(true), backend], ['web', npm, ['run', 'dev'], frontend]]) },
  api() { requireVenv(); longRunning([['api', venvPy, apiArgs(true), backend]]) },
  web() { requireWebDeps(); longRunning([['web', npm, ['run', 'dev'], frontend]]) },
  build() { requireWebDeps(); run(npm, ['run', 'build'], { cwd: frontend }) },
  start() { requireVenv(); requireWebDeps(); run(npm, ['run', 'build'], { cwd: frontend }); console.log('\nServing app + API on http://127.0.0.1:8000\n'); longRunning([['server', venvPy, apiArgs(false), backend]]) },
  test() { const py = existsSync(venvPy) ? [venvPy] : findPython(); run(py[0], [...py.slice(1), '-m', 'unittest', 'discover', '-s', 'tests', '-v'], { cwd: backend }) },
}

const name = process.argv[2]
if (!commands[name]) fail(`Unknown command "${name ?? ''}". Use one of: ${Object.keys(commands).join(', ')}`)
commands[name]()
