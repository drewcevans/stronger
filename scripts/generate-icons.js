import sharp from 'sharp'
import { existsSync, mkdirSync } from 'fs'
import { Buffer } from 'buffer'

if (!existsSync('public/icons')) {
  mkdirSync('public/icons', { recursive: true })
}

const iconSvg = `
<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" fill="#000000" rx="80"/>
  <text x="256" y="320" font-family="monospace" font-size="280"
    font-weight="900" fill="#E8FF00" text-anchor="middle">S</text>
</svg>`

sharp(Buffer.from(iconSvg))
  .resize(512, 512)
  .png()
  .toFile('public/icons/icon-512.png')
  .then(() => sharp(Buffer.from(iconSvg))
    .resize(192, 192)
    .png()
    .toFile('public/icons/icon-192.png'))
  .then(() => console.log('Icons generated'))
  .catch(console.error)
