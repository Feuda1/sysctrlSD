const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

// Load secrets from .env (kept out of git). GH_TOKEN is required to publish.
try {
  const envPath = path.join(__dirname, '..', '.env')
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
} catch {}

if (!process.env.GH_TOKEN) {
  console.error('GH_TOKEN не задан. Добавьте его в .env (GH_TOKEN=github_pat_...).')
  process.exit(1)
}

execSync('npm run build', { stdio: 'inherit' })
execSync('npx electron-builder --win --publish always', { stdio: 'inherit' })
