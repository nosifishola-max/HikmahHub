const fetch = global.fetch;
(async () => {
  try {
    const r = await fetch('http://127.0.0.1:3001/api/health');
    const t = await r.text();
    console.log('STATUS=' + r.status);
    console.log(t);
  } catch (e) {
    console.error('ERROR=' + (e && e.message ? e.message : String(e)));
    process.exit(1);
  }
})();
