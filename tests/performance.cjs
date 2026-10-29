// CI-only browser dependency; never shipped to students. Anonymous home reads only.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/tmp/hikmah-tools/node_modules/playwright');
const { spawn, execFileSync } = require('node:child_process');
const fs = require('node:fs');
async function serve(root, port) {
 const child = spawn(process.execPath, ['dev-server.js'], { cwd: root, env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','inherit'] });
 await new Promise((resolve,reject) => { child.stdout.once('data',resolve); child.once('error',reject); child.once('exit',c=>reject(Error('server exit '+c))); }); return child;
}
(async()=>{
 fs.mkdirSync('/tmp/hikmah-baseline',{recursive:true});
 execFileSync('sh',['-c','git archive 911daab43801849b1ed1c8e41706f5364910a2dc | tar -x -C /tmp/hikmah-baseline']);
 const before=await serve('/tmp/hikmah-baseline',5268), after=await serve(process.cwd(),5269);
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM || '/usr/bin/google-chrome',args:['--no-sandbox']});
 try {
 const results=[];
 for (const [version,port] of [['before',5268],['after',5269]]) {
 const context=await browser.newContext({viewport:{width:360,height:800},serviceWorkers:'block'});
 const page=await context.newPage(); const cdp=await context.newCDPSession(page);
 await cdp.send('Network.enable');await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:400,downloadThroughput:50000,uploadThroughput:25000,connectionType:'cellular3g'});await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 let bytes=0,requests=0, failures=0; const urls=new Map(), transfers={};
 cdp.on('Network.requestWillBeSent',e=>{requests++;urls.set(e.requestId,e.request.url)});cdp.on('Network.loadingFinished',e=>{bytes+=e.encodedDataLength;const u=urls.get(e.requestId)||'';const group=u.includes('/storage/')?'storage':u.includes('cdn.jsdelivr')?'sdk':u.includes('/rest/')?'api':'static';transfers[group]=(transfers[group]||0)+e.encodedDataLength;});cdp.on('Network.loadingFailed',()=>failures++);
 await page.addInitScript(()=>{window.__lcp=0;new PerformanceObserver(list=>{window.__lcp=list.getEntries().at(-1).startTime}).observe({type:'largest-contentful-paint',buffered:true});});
 const started=Date.now();await page.goto(`http://localhost:${port}`,{waitUntil:'load',timeout:90000});await page.waitForLoadState('networkidle', {timeout:60000});await page.waitForTimeout(3000);
 const metrics=await page.evaluate(()=>({fcp:performance.getEntriesByName('first-contentful-paint')[0]?.startTime??null,lcp:window.__lcp,domContentLoaded:performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd,rendered:!!document.querySelector('.hero')}));
 results.push({version,profile:'360px, 400ms RTT, 50kB/s download, 4x CPU, cold, SW blocked',...metrics,bytes,requests,failures,transfers,observedMs:Date.now()-started});
 // Intermittent connectivity: static loaded UI remains intact, then recovery is possible.
 await context.setOffline(true);await page.waitForTimeout(500);if(!await page.locator('.hero').count())throw Error('Offline page lost hero');await context.setOffline(false);
 await context.close();
 }
 fs.mkdirSync('test-results',{recursive:true});
 for(const width of [320,360,412,768,1100]){const shot=await browser.newPage({viewport:{width,height:844}});await shot.goto('http://localhost:5269/tests/browser-smoke.html');await shot.waitForFunction(()=>document.querySelector('#result')?.textContent.startsWith('PASS:'));if(await shot.evaluate(()=>innerWidth)!==width)throw Error('Viewport was not applied');await shot.screenshot({path:`test-results/android-account-${width}.png`,fullPage:true});await shot.close();} console.log('Exact Playwright viewports 320/360/412/768/1100 and account screenshot assertions PASS');
 fs.mkdirSync('test-results',{recursive:true});fs.writeFileSync('test-results/performance.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));
 if(results.some(r=>!r.rendered))throw Error('Homepage did not render');
 } finally {await browser.close();before.kill();after.kill();}
})().catch(e=>{console.error(e);process.exitCode=1});
