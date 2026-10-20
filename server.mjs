import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const directory=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(directory,process.argv.includes('--dist')?'dist':'.');
const port=Number(process.env.PORT||4173);
const mime={'.svg':'image/svg+xml','.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.md':'text/plain; charset=utf-8','.json':'application/json'};
const server=http.createServer(async(req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=path.resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':''));
  if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403);res.end('Forbidden');return}
  if(!(await stat(file)).isFile())throw new Error('Not a file');
  const bytes=await readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);
 }catch{res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found')}
});
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?`Port ${port} is busy. Open http://127.0.0.1:${port} or set a different PORT.`:e.message);process.exit(1)});
server.listen(port,'127.0.0.1',()=>console.log(`FRYE demo ready: http://127.0.0.1:${port}\nDemo data only. Press Ctrl+C to stop.`));
