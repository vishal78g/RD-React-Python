import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

const appEnv = String(process.env.APP_ENV || process.env.NODE_ENV || 'local').toLowerCase()
const modeFile = appEnv === 'production' ? '.env.production' : '.env.local'

const baseEnvPath = path.join(projectRoot, '.env')
if (fs.existsSync(baseEnvPath)) {
  dotenv.config({ path: baseEnvPath })
}

const modeEnvPath = path.join(projectRoot, modeFile)
if (fs.existsSync(modeEnvPath)) {
  dotenv.config({ path: modeEnvPath, override: true })
}

export const currentAppEnv = appEnv
