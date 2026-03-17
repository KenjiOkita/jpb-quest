import fs from 'node:fs'
import path from 'node:path'

const envFiles = ['.env.local', '.env']

for (const fileName of envFiles) {
  const filePath = path.join(process.cwd(), fileName)
  if (!fs.existsSync(filePath)) continue

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmedLine = line.trim()
    if (!trimmedLine || trimmedLine.startsWith('#')) continue

    const separatorIndex = trimmedLine.indexOf('=')
    if (separatorIndex === -1) continue

    const key = trimmedLine.slice(0, separatorIndex).trim()
    if (!key || process.env[key]) continue

    let value = trimmedLine.slice(separatorIndex + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    process.env[key] = value
  }
}

const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
]

const missingEnvVars = requiredEnvVars.filter((key) => {
  const value = process.env[key]
  return typeof value !== 'string' || value.trim() === ''
})

if (missingEnvVars.length > 0) {
  console.error('')
  console.error('Deployment blocked: required environment variables are missing.')
  console.error(`Missing: ${missingEnvVars.join(', ')}`)
  console.error('')
  process.exit(1)
}

if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
  console.warn('Warning: NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set. Push notifications will stay disabled.')
}
