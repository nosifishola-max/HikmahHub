const { spawn, spawnSync } = require('node:child_process');
const server = spawn(process.execPath, ['dev-server.js'], { env: { ...process.env, PORT: '5267' }, stdio: ['ignore','pipe','inherit'] });
let started = false;
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.on('exit', code => { if (!started && code !== 0) process.exitCode = 1; });
server.stdout.once('data', () => {
  started = true;
  let failed = false;
  for (const width of [320, 360, 390, 768, 1280]) {
    const result = spawnSync(process.env.CHROMIUM || 'chromium', ['--headless','--no-sandbox','--disable-gpu','--disable-background-networking',`--window-size=${width},900`,'--virtual-time-budget=3000','--dump-dom','http://localhost:5267/tests/browser-smoke.html'], { encoding:'utf8', timeout:20000 });
    const pass = result.status === 0 && result.stdout.includes('<pre id="result">PASS:');
    console.log(`${width}px: ${pass ? 'PASS (7 assertions)' : 'FAIL'}`);
    if (!pass) { console.error(result.stdout || result.stderr); failed = true; }
  }
  server.kill(); process.exitCode = failed ? 1 : 0;
});
