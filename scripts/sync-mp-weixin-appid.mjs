import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

const manifestPath = path.join(projectRoot, 'manifest.json')
const distProjectConfigPath = path.join(projectRoot, 'dist', 'build', 'mp-weixin', 'project.config.json')

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

if (!fs.existsSync(manifestPath)) {
  console.warn('[sync-mp-weixin-appid] manifest.json not found, skip')
  process.exit(0)
}

if (!fs.existsSync(distProjectConfigPath)) {
  console.warn('[sync-mp-weixin-appid] dist project.config.json not found, skip')
  process.exit(0)
}

const manifest = readJson(manifestPath)
const appId = manifest?.['mp-weixin']?.appid

if (!appId || appId === 'touristappid') {
  console.warn('[sync-mp-weixin-appid] mp-weixin.appid is empty/invalid, skip')
  process.exit(0)
}

const distProjectConfig = readJson(distProjectConfigPath)
distProjectConfig.appid = appId
writeJson(distProjectConfigPath, distProjectConfig)

console.log(`[sync-mp-weixin-appid] synced appid -> ${appId}`)
