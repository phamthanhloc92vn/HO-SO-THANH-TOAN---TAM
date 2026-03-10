const fs = require('fs');
const path = require('path');

function copyDirStructure(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDirStructure(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

const standaloneDir = path.join(__dirname, '.next', 'standalone');
const publicSrc = path.join(__dirname, 'public');
const staticSrc = path.join(__dirname, '.next', 'static');

const publicDest = path.join(standaloneDir, 'public');
const staticDest = path.join(standaloneDir, '.next', 'static');

console.log('Copying static assets for standalone build...');

if (fs.existsSync(publicSrc)) {
    copyDirStructure(publicSrc, publicDest);
}

if (fs.existsSync(staticSrc)) {
    copyDirStructure(staticSrc, staticDest);
}

console.log('Static assets copied successfully.');
