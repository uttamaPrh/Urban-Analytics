import https from 'https'
import fs from 'fs'
import path from 'path'

const URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson'
const OUT = path.resolve(process.cwd(), 'public', 'countries.geojson')

function download(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(dest)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    const file = fs.createWriteStream(dest)
    https.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 400) return reject(new Error(`Request failed ${res.statusCode}`))
      res.pipe(file)
      file.on('finish', () => file.close(() => resolve()))
    }).on('error', (err) => reject(err))
  })
}

async function main() {
  console.log('Downloading countries GeoJSON...')
  try {
    await download(URL, OUT)
    console.log('Saved to', OUT)
  } catch (err) {
    console.error('Download failed:', err)
    process.exit(1)
  }
}

if (require.main === module) main()
