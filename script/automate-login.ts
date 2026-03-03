import { _electron as electron } from 'playwright' // note the underscore!
;(async () => {
  // Launch YOUR Electron app (adjust paths/args to match your setup)
  // If using vite dev: args point to your built main.js or use cwd
  const electronApp = await electron.launch({
    args: ['.'], // or ['path/to/your/main.js'] if packaged
    // For dev mode with vite/electron-vite: often just cwd + args
    cwd: process.cwd() // run from project root
    // If you have a built app: executablePath: 'path/to/your-app.exe'
    // For now, assuming dev mode
  })

  // Get the first (main) window's Page — this is your React renderer
  const page = await electronApp.firstWindow()

  // Optional: Wait for your app to be ready (e.g. React mounted)
  await page.waitForSelector('text=Your App Title or some element') // adjust

  // Now automate INSIDE your app's window — e.g. navigate to login site
  await page.goto('https://facebook.com')

  // Same login code as before, but now it runs in YOUR app's window!
  await page.getByRole('textbox', { name: /user|email/i }).fill('yourusername')
  await page.getByRole('textbox', { name: /password/i }).fill('yourpassword')

  // Submit
  const loginButton = page.getByRole('button', { name: /login|sign in/i })
  if (await loginButton.isVisible()) {
    await loginButton.click()
  } else {
    await page.getByRole('textbox', { name: /password/i }).press('Enter')
  }

  // Wait for success
  await page.waitForURL('**/dashboard**', { timeout: 15000 })
  console.log('Logged in inside the Electron app!')

  // Keep app open (or automate further, take screenshot, etc.)
  // await electronApp.close(); // when done

  // Bonus: Evaluate code in Electron main process if needed
  const appVersion = await electronApp.evaluate(async ({ app }) => app.getVersion())
  console.log('Your Electron app version:', appVersion)
})()
