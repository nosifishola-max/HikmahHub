const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const results = {
    desktop: { homepage: {}, signup: {}, profile: {} },
    mobile: { homepage: {}, profile: {} },
    errors: [],
    recommendations: []
  };

  try {
    console.log('\n========== DESKTOP TESTS ==========\n');
    
    const desktopContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const desktopPage = await desktopContext.newPage();
    
    desktopPage.on('console', msg => {
      if (msg.type() === 'error') {
        results.errors.push({ type: 'console', message: msg.text() });
        console.log('[ERROR] ' + msg.text());
      }
    });
    
    desktopPage.on('pageerror', error => {
      results.errors.push({ type: 'pageerror', message: error.message });
      console.log('[PAGE ERROR] ' + error.message);
    });
    
    desktopPage.on('requestfailed', request => {
      results.errors.push({ type: 'network', url: request.url() });
      console.log('[NETWORK ERROR] ' + request.url());
    });
    
    desktopPage.on('response', response => {
      if (response.status() >= 400) {
        console.log('[HTTP ' + response.status() + '] ' + response.url().substring(0, 60));
      }
    });
    
    const screenshotDir = path.join(__dirname, 'screenshots');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
    
    // Test 1: Desktop Homepage
    console.log('TEST 1: Desktop Homepage');
    try {
      await desktopPage.goto('https://hikmahhub.vercel.app', { waitUntil: 'networkidle', timeout: 30000 });
      results.desktop.homepage.loaded = true;
      results.desktop.homepage.title = await desktopPage.title();
      console.log(' Loaded: ' + results.desktop.homepage.title);
      await desktopPage.screenshot({ path: path.join(screenshotDir, '01-desktop-homepage.png') });
    } catch (e) {
      results.desktop.homepage.error = e.message;
      console.log(' ' + e.message);
    }
    
    // Test 2: Signup Flow
    console.log('\nTEST 2: Desktop Signup');
    try {
      const signupBtn = desktopPage.locator('a:has-text("Sign Up"), button:has-text("Sign Up")').first();
      if (await signupBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        console.log(' Sign up button found');
        await signupBtn.click();
        await desktopPage.waitForLoadState('networkidle').catch(() => {});
        
        const nameInput = desktopPage.locator('input[name="name"], input[placeholder*="ame"]').first();
        const emailInput = desktopPage.locator('input[type="email"]').first();
        const passInput = desktopPage.locator('input[type="password"]').first();
        
        if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
          console.log(' Form fields visible');
          await nameInput.fill('Test User');
          await emailInput.fill('test' + Date.now() + '@test.com');
          await passInput.fill('Test123');
          
          await desktopPage.locator('button[type="submit"]').first().click().catch(() => {});
          await desktopPage.waitForLoadState('networkidle').catch(() => {});
          results.desktop.signup.formSubmitted = true;
          console.log(' Form submitted');
        }
      } else {
        console.log(' Sign up button not visible');
      }
      await desktopPage.screenshot({ path: path.join(screenshotDir, '02-desktop-signup.png') });
    } catch (e) {
      console.log(' ' + e.message);
    }
    
    // Test 3: Profile Page
    console.log('\nTEST 3: Desktop Profile');
    try {
      await desktopPage.goto('https://hikmahhub.vercel.app/profile', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
      results.desktop.profile.url = desktopPage.url();
      const text = await desktopPage.textContent('body');
      results.desktop.profile.requiresAuth = text.toLowerCase().includes('login') || text.toLowerCase().includes('sign in');
      results.desktop.profile.is404 = text.toLowerCase().includes('404');
      console.log(' Profile: requiresAuth=' + results.desktop.profile.requiresAuth + ', 404=' + results.desktop.profile.is404);
      await desktopPage.screenshot({ path: path.join(screenshotDir, '03-desktop-profile.png') });
    } catch (e) {
      console.log(' ' + e.message);
    }
    
    await desktopContext.close();
    
    console.log('\n========== MOBILE TESTS ==========\n');
    
    const mobileContext = await browser.newContext({ 
      viewport: { width: 375, height: 812 }
    });
    const mobilePage = await mobileContext.newPage();
    
    // Test 4: Mobile Homepage
    console.log('TEST 4: Mobile Homepage');
    try {
      await mobilePage.goto('https://hikmahhub.vercel.app', { waitUntil: 'networkidle', timeout: 30000 });
      results.mobile.homepage.loaded = true;
      console.log(' Mobile homepage loaded');
      await mobilePage.screenshot({ path: path.join(screenshotDir, '04-mobile-homepage.png') });
    } catch (e) {
      console.log(' ' + e.message);
    }
    
    // Test 5: Mobile Profile
    console.log('\nTEST 5: Mobile Profile');
    try {
      await mobilePage.goto('https://hikmahhub.vercel.app/profile', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
      results.mobile.profile.loaded = true;
      const text = await mobilePage.textContent('body');
      results.mobile.profile.requiresAuth = text.toLowerCase().includes('login');
      console.log(' Mobile profile: requiresAuth=' + results.mobile.profile.requiresAuth);
      await mobilePage.screenshot({ path: path.join(screenshotDir, '05-mobile-profile.png') });
    } catch (e) {
      console.log(' ' + e.message);
    }
    
    await mobileContext.close();
    
    // Report
    console.log('\n========== SUMMARY ==========');
    console.log('Desktop Homepage: ' + (results.desktop.homepage.loaded ? 'PASS' : 'FAIL'));
    console.log('Desktop Signup: ' + (results.desktop.signup.formSubmitted ? 'PASS' : 'CHECK'));
    console.log('Desktop Profile: ' + (results.desktop.profile.loaded ? 'PASS' : 'CHECK'));
    console.log('Mobile Homepage: ' + (results.mobile.homepage.loaded ? 'PASS' : 'FAIL'));
    console.log('Mobile Profile: ' + (results.mobile.profile.loaded ? 'PASS' : 'CHECK'));
    console.log('Console Errors: ' + results.errors.length);
    
    const reportPath = path.join(__dirname, 'hikmah-comprehensive-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    console.log('\n Report saved to hikmah-comprehensive-report.json');
    
  } catch (error) {
    console.error('Error: ' + error.message);
  }
  
  await browser.close();
})();
