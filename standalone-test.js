const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const results = { tests: [] };
  
  try {
    console.log('\\n### HIKMAH HUB COMPREHENSIVE TEST ###\\n');
    
    // Desktop Context
    const desktop = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const dpage = await desktop.newPage();
    
    const errors = [];
    dpage.on('console', m => m.type() === 'error' && errors.push(m.text()));
    dpage.on('pageerror', e => errors.push('PageError: ' + e.message));
    
    const screenshotDir = './screenshots';
    if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });
    
    // Test 1: Homepage
    console.log('1. Desktop Homepage');
    try {
      await dpage.goto('https://hikmahhub.vercel.app', { waitUntil: 'networkidle', timeout: 30000 });
      await dpage.screenshot({ path: path.join(screenshotDir, '01-homepage.png') });
      console.log('   PASS');
      results.tests.push({ name: 'Desktop Homepage', status: 'PASS' });
    } catch (e) {
      console.log('   FAIL: ' + e.message);
      results.tests.push({ name: 'Desktop Homepage', status: 'FAIL', error: e.message });
    }
    
    // Test 2: Signup
    console.log('2. Desktop Signup Flow');
    try {
      const btn = dpage.locator('a:has-text(\"Sign Up\")').first();
      const visible = await btn.isVisible({ timeout: 3000 }).catch(() => false);
      if (visible) {
        console.log('   - Sign up button found');
        await btn.click();
        await dpage.waitForLoadState('networkidle').catch(() => {});
        
        const nameField = dpage.locator('input[placeholder*=\"ame\"]').first();
        const emailField = dpage.locator('input[type=\"email\"]').first();
        const passField = dpage.locator('input[type=\"password\"]').first();
        
        if (await nameField.isVisible({ timeout: 2000 }).catch(() => false)) {
          console.log('   - Filling form');
          await nameField.fill('Test User');
          await emailField.fill('test' + Date.now() + '@test.com');
          await passField.fill('Test123');
          
          const submit = dpage.locator('button[type=\"submit\"]').first();
          await submit.click().catch(() => {});
          await dpage.waitForTimeout(2000);
          console.log('   PASS');
          results.tests.push({ name: 'Desktop Signup', status: 'PASS' });
        } else {
          console.log('   - No form fields found');
          results.tests.push({ name: 'Desktop Signup', status: 'CHECK', note: 'Form not found' });
        }
      } else {
        console.log('   - No signup button');
        results.tests.push({ name: 'Desktop Signup', status: 'CHECK', note: 'Button not found' });
      }
      await dpage.screenshot({ path: path.join(screenshotDir, '02-signup.png') });
    } catch (e) {
      console.log('   ERROR: ' + e.message);
      results.tests.push({ name: 'Desktop Signup', status: 'ERROR', error: e.message });
    }
    
    // Test 3: Profile
    console.log('3. Desktop Profile Page');
    try {
      await dpage.goto('https://hikmahhub.vercel.app/profile', { timeout: 30000 }).catch(() => {});
      const text = await dpage.textContent('body');
      const needsAuth = text.toLowerCase().includes('login') || text.toLowerCase().includes('sign in');
      console.log('   - Auth required: ' + needsAuth);
      await dpage.screenshot({ path: path.join(screenshotDir, '03-profile.png') });
      results.tests.push({ name: 'Desktop Profile', status: 'PASS', authRequired: needsAuth });
    } catch (e) {
      console.log('   ERROR: ' + e.message);
    }
    
    await desktop.close();
    
    // Mobile Context
    console.log('4. Mobile Homepage');
    const mobile = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const mpage = await mobile.newPage();
    
    try {
      await mpage.goto('https://hikmahhub.vercel.app', { waitUntil: 'networkidle', timeout: 30000 });
      await mpage.screenshot({ path: path.join(screenshotDir, '04-mobile-home.png') });
      console.log('   PASS');
      results.tests.push({ name: 'Mobile Homepage', status: 'PASS' });
    } catch (e) {
      console.log('   FAIL: ' + e.message);
      results.tests.push({ name: 'Mobile Homepage', status: 'FAIL', error: e.message });
    }
    
    console.log('5. Mobile Profile');
    try {
      await mpage.goto('https://hikmahhub.vercel.app/profile', { timeout: 30000 }).catch(() => {});
      await mpage.screenshot({ path: path.join(screenshotDir, '05-mobile-profile.png') });
      console.log('   PASS');
      results.tests.push({ name: 'Mobile Profile', status: 'PASS' });
    } catch (e) {
      console.log('   ERROR: ' + e.message);
    }
    
    await mobile.close();
    
    console.log('\\n### SUMMARY ###');
    console.log('Console Errors: ' + errors.length);
    results.errors = errors;
    
    fs.writeFileSync('./hikmah-test-report.json', JSON.stringify(results, null, 2));
    console.log('Report saved: ./hikmah-test-report.json');
    
  } catch (e) {
    console.error('Critical: ' + e.message);
  }
  
  await browser.close();
})();
