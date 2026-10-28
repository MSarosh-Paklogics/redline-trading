import { mkdir, copyFile, cp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root=path.dirname(fileURLToPath(import.meta.url));
await mkdir(path.join(root,'dist'),{recursive:true});
for(const file of ['index.html','backend-api.js','live-surfaces.js','styles.css','app.js','engines.js','motion.js','navigation.js','chart-tools.js','terminal.js','corsa.js','protection.js'])await copyFile(path.join(root,file),path.join(root,'dist',file));
console.log('Built self-contained static demo in dist/. No dependencies or network required.');

await cp(path.join(root,'references'),path.join(root,'dist','references'),{recursive:true});

await cp(path.join(root,'assets'),path.join(root,'dist','assets'),{recursive:true});


