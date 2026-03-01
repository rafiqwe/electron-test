import { chromium } from 'playwright'
;(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 300 }) // slowMo helps debug
  const page = await browser.newPage()

  // Optional: Set viewport if site is responsive/mobile-like
  // await page.setViewportSize({ width: 1280, height: 800 })

  await page.goto('https://facebook.com', { waitUntil: 'networkidle' }) // wait for JS to settle

  // Debug: Print all labels and placeholders to see what's actually there
  console.log('Available labels:')
  const labels = await page.locator('label').allInnerTexts()
  console.log(labels)

  console.log('Available placeholders:')
  const placeholders = await page
    .getByRole('textbox')
    .evaluateAll((els) => els.map((el) => (el as HTMLInputElement).placeholder))
  console.log(placeholders)

  // Try these locator variations one by one — comment out others

  // Option 1: Best - getByLabel (if label exists and is visible/associated)
  await page.getByLabel('Username').or(page.getByLabel('Email')).fill('yourusername') // fallback
  await page.getByLabel('Password').fill('yourpassword')

  // Option 2: If no label, use placeholder
  // await page.getByPlaceholder('Enter username or email').fill('yourusername');
  // await page.getByPlaceholder('Password').fill('yourpassword');

  // Wait a sec to see if fields got filled
  // await page.waitForTimeout(2000) // just for debug

  // Submit: Try click first
  const loginButton = page.getByRole('button', { name: /login|sign in|submit|continue|entrar/i })

  if (await loginButton.isVisible()) {
    await loginButton.click()
    console.log('Clicked login button')
  } else {
    console.log('No login button found — pressing Enter in password field')

    // FIXED version – only targets the password input
    const passwordInput = page.getByRole('textbox', { name: /password/i })
    // or fallback: page.locator('input[name="pass"]') or page.getByLabel('Password')

    if ((await passwordInput.count()) === 1) {
      await passwordInput.press('Enter')
      console.log('Pressed Enter in password field')
    } else {
      console.log('Still multiple or no password input found – check page manually')
      // Debug: highlight it
      await passwordInput.highlight()
    }
  }
  // Keep open for inspection
  await browser.close()
})()
