import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

export async function generateElectronIcons(destination) {
  const source = await readFile('public/favicon.svg');
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const images = await Promise.all(
    sizes.map((size) => sharp(source, { density: 512 }).resize(size, size).png().toBuffer()),
  );
  await mkdir(destination, { recursive: true });
  await Promise.all([
    writeFile(resolve(destination, 'icon.ico'), await pngToIco(images)),
    writeFile(resolve(destination, 'icon.png'), images[images.length - 1]),
  ]);
}
