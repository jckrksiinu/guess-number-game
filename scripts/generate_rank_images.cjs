const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const outputDir = path.join(__dirname, '..', 'public', 'images', 'ranks');
const size = 80;

const colors = {
  F: { bg: [99, 102, 241], label: 'F' },
  E: { bg: [139, 92, 246], label: 'E' },
  D: { bg: [59, 130, 246], label: 'D' },
  C: { bg: [16, 185, 129], label: 'C' },
  B: { bg: [245, 158, 11], label: 'B' },
  A: { bg: [239, 68, 68], label: 'A' }
};

const rankNames = {
  F: 'บรอนซ์', E: 'เงิน', D: 'ทอง', C: 'แพลตตินัม', B: 'ไดมอนด์', A: 'มาสเตอร์'
};

for (const [rank, info] of Object.entries(colors)) {
  for (let stars = 1; stars <= 4; stars++) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    
    // Background circle
    ctx.beginPath();
    ctx.arc(size/2, size/2, size/2 - 3, 0, Math.PI * 2);
    ctx.fillStyle = `rgb(${info.bg[0]}, ${info.bg[1]}, ${info.bg[2]})`;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Rank letter
    ctx.fillStyle = 'white';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(rank, size/2, size/2 - 6);
    
    // Stars
    let starText = '';
    for (let s = 0; s < stars; s++) starText += '⭐';
    ctx.font = '10px Arial';
    ctx.fillText(starText, size/2, size/2 + 18);
    
    // Save
    const filename = `${rank}${stars}ดาว.png`;
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(path.join(outputDir, filename), buffer);
    console.log(`✅ ${filename}`);
  }
}

console.log('All rank images generated!');
