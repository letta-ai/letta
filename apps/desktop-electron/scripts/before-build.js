// check os
const fs = require('fs');
const path = require('path');

if (process.platform === 'win32') {
  // remove `letta` from `dist` folder
  const distPath = path.resolve(__dirname, '../dist');
  const lettaPath = path.resolve(distPath, 'letta');
  if (fs.existsSync(lettaPath)) {
    fs.unlinkSync(lettaPath);
  }
} else {
  // remove `letta.exe` from `dist` folder
  const distPath = path.resolve(__dirname, '../dist');
  const lettaPath = path.resolve(distPath, 'letta.exe');
  if (fs.existsSync(lettaPath)) {
    fs.unlinkSync(lettaPath);
  }
}
