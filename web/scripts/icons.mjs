import sharp from 'sharp';
const src = 'public/icon.svg';
for (const [name, size] of [['pwa-192.png', 192], ['pwa-512.png', 512], ['apple-touch-icon.png', 180]]) {
  await sharp(src, { density: 300 }).resize(size, size).png().toFile(`public/${name}`);
}
console.log('ok');
