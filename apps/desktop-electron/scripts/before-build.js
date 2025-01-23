// check os
const fs = require('fs');
const path = require('path');

module.exports = async ({ arch }) => {
  if (arch === 'win32') {
    // remove `letta` from `dist` folder
    const distPath = path.resolve(__dirname, '../dist');
    const lettaPath = path.resolve(distPath, 'letta');
    if (fs.existsSync(lettaPath)) {
      fs.rmSync(lettaPath);
    }
  } else {
    // remove `letta.exe` from `dist` folder
    const distPath = path.resolve(__dirname, '../dist');
    const lettaPath = path.resolve(distPath, 'letta.exe');
    if (fs.existsSync(lettaPath)) {
      fs.rmSync(lettaPath);
    }
  }
};
