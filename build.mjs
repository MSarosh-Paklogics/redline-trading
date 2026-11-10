import { mkdir, copyFile, cp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root=path.dirname(fileURLToPath(import.meta.url));
await mkdir(path.join(root,'dist'),{recursive:true});
for(const file of ['index.html','backend-api.js','live-surfaces.js','market-xray.js','xray-sections.js','hero-video.js','hero-candles.js','chart-engines.js','live-quotes.js','live-stream.js','chart-interact.js','dashboard-board.js','strategies-live.js','journal-real.js','journal-live.js','cockpit-cluster.js','sectors-live.js','styles.css','app.js','engines.js','motion.js','navigation.js','chart-tools.js','terminal.js','corsa.js','page-nav.js','motion-pro.js','protection.js'])await copyFile(path.join(root,file),path.join(root,'dist',file));
console.log('Built self-contained static demo in dist/. No dependencies or network required.');

await cp(path.join(root,'references'),path.join(root,'dist','references'),{recursive:true});

await cp(path.join(root,'assets'),path.join(root,'dist','assets'),{recursive:true});


