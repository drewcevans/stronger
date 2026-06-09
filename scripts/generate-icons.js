import sharp from 'sharp'
import { existsSync, mkdirSync } from 'fs'

if (!existsSync('public/icons')) {
  mkdirSync('public/icons', { recursive: true })
}

async function generateIcon(size, outputPath) {
  const padding = Math.round(size * 0.1)
  const imgSize = size - padding * 2

  const boltBuffer = await sharp('src/assets/stronger-bolt.png')
    .resize(imgSize, imgSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer()

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 255 },
    },
  })
    .composite([{ input: boltBuffer, top: padding, left: padding }])
    .png()
    .toFile(outputPath)

  console.log(`Generated ${outputPath} (${size}x${size})`)
}

generateIcon(512, 'public/icons/icon-512.png')
  .then(() => generateIcon(192, 'public/icons/icon-192.png'))
  .then(() => console.log('Done'))
  .catch(console.error)
