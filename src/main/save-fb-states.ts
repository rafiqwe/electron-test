import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'

const accounts = [{ id: 'acc1', email: 'email1@example.com', pass: 'pass1' }]

const userDataDir = path.join(__dirname, 'fb-states')

async function loginAndSave(acc): Promise<void> {
  const browser = await chromium.launch({ headless: false }) // headed first time
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto('https://www.facebook.com/login')
  await page.getByLabel('Email or phone number').fill(acc.email)
  await page.getByLabel('Password').fill(acc.pass)
  await page.getByRole('button', { name: /log in/i }).click()
  await page.waitForURL(/facebook\.com\/(home|feed)/, { timeout: 120000 }) // handle 2FA manually
  await context.storageState({ path: path.join(userDataDir, `${acc.id}.json`) })
  await browser.close()
  console.log(`Saved state for ${acc.id}`)
}

;(async () => {
  fs.mkdirSync(userDataDir, { recursive: true })
  for (const acc of accounts) {
    await loginAndSave(acc)
    await new Promise((r) => setTimeout(r, 5000)) // delay to avoid rate limit
  }
})()
