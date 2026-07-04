const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

const inputDir = path.join(process.env.USERPROFILE, 'Downloads', 'Rank');
const outputDir = path.join(__dirname, '..', 'public', 'images', 'ranks');

const ranks = ['F', 'E', 'D', 'C', 'B', 'A'];

async function main() {
  for (const r of ranks) {
    const filePath = path.join(inputDir, `${r}.png`);
    if (!fs.existsSync(filePath)) {
      console.log(`❌ ${r}.png not found in ${inputDir}`);
      continue;
    }
    const img = await loadImage(filePath);
    console.log(`${r}.png: ${img.width} x ${img.height}`);
    
    const w = img.width;
    const h = img.height;
    
    // 1536x1024 → likely 2x2 grid (768x512 per badge)
    let cols = 2, rows = 2;
    let partWidth = Math.floor(w / cols);
    let partHeight = Math.floor(h / rows);
    
    for (let star = 1; star <= 4; star++) {
      const col = (star - 1) % cols;
      const row = Math.floor((star - 1) / cols);
      const sx = col * partWidth;
      const sy = row * partHeight;
      
      const canvas = createCanvas(partWidth, partHeight);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, sx, sy, partWidth, partHeight, 0, 0, partWidth, partHeight);
      
      const outPath = path.join(outputDir, `${r}${star}ดาว.png`);
      const buf = canvas.toBuffer('image/png');
      fs.writeFileSync(outPath, buf);
      console.log(`  → ${r}${star}ดาว.png (${partWidth}x${partHeight})`);
    }
  }
  console.log('✅ All rank images split and saved!');
}

main().catch(e => console.error('Error:', e));
