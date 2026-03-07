import { app, shell, BrowserWindow, ipcMain, WebContents } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import * as fs from 'fs/promises'

let mainWindow: BrowserWindow | null = null
const accountWindows = new Map<string, BrowserWindow>()
const STORAGE_DIR = join(app.getPath('userData'), 'fb-states')
const ACCOUNTS_FILE = join(app.getPath('userData'), 'accounts.json')

interface Account {
  id: string
  username: string
  password: string
  name: string
  status: 'active' | 'inactive' | 'error' | 'logged-in'
  lastLogin?: string
  notes?: string
  proxy?: string
}

async function ensureStorageDir(): Promise<void> {
  try {
    await fs.mkdir(STORAGE_DIR, { recursive: true })
  } catch (err) {
    console.error('Failed to create storage dir:', err)
  }
}

async function loadAccounts(): Promise<Account[]> {
  try {
    const data = await fs.readFile(ACCOUNTS_FILE, 'utf-8')
    return JSON.parse(data)
  } catch (err) {
    return []
  }
}

async function saveAccounts(accounts: Account[]): Promise<void> {
  try {
    await fs.writeFile(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2))
  } catch (err) {
    console.error('Failed to save accounts:', err)
    throw err
  }
}

async function updateAccountStatus(accountId: string, status: Account['status']): Promise<void> {
  const accounts = await loadAccounts()
  const account = accounts.find((acc) => acc.id === accountId)
  if (account) {
    account.status = status
    if (status === 'logged-in') {
      account.lastLogin = new Date().toISOString()
    }
    await saveAccounts(accounts)
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  if (is.dev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  }
}

app.whenReady().then(async () => {
  await ensureStorageDir()
  electronApp.setAppUserModelId('com.fb-account-manager')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.on('ping', () => console.log('pong'))
  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// ====================== ACCOUNT MANAGEMENT ======================

ipcMain.handle('get-accounts', async () => {
  try {
    const accounts = await loadAccounts()
    return { success: true, accounts }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('add-account', async (event, account: Omit<Account, 'id' | 'status'>) => {
  try {
    const accounts = await loadAccounts()
    const newAccount: Account = {
      ...account,
      id: `acc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'inactive'
    }
    accounts.push(newAccount)
    await saveAccounts(accounts)
    return { success: true, account: newAccount }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle(
  'update-account',
  async (event, { id, updates }: { id: string; updates: Partial<Account> }) => {
    try {
      const accounts = await loadAccounts()
      const index = accounts.findIndex((acc) => acc.id === id)
      if (index === -1) {
        return { success: false, error: 'Account not found' }
      }
      accounts[index] = { ...accounts[index], ...updates }
      await saveAccounts(accounts)
      return { success: true, account: accounts[index] }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }
)

ipcMain.handle('delete-account', async (event, accountId: string) => {
  try {
    const accounts = await loadAccounts()
    const filtered = accounts.filter((acc) => acc.id !== accountId)
    await saveAccounts(filtered)

    const win = accountWindows.get(accountId)
    if (win && !win.isDestroyed()) {
      win.close()
    }

    const statePath = join(STORAGE_DIR, `${accountId}.json`)
    try {
      await fs.unlink(statePath)
    } catch (e) {}

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

// ====================== WINDOW MANAGEMENT ======================

// Helper function to open a single account window
async function openSingleAccountWindow(
  accountId: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    // Check if window already exists
    if (accountWindows.has(accountId)) {
      const existingWin = accountWindows.get(accountId)!
      if (!existingWin.isDestroyed()) {
        existingWin.focus()
        return { success: true, message: 'Window already open' }
      } else {
        accountWindows.delete(accountId)
      }
    }

    const accounts = await loadAccounts()
    const account = accounts.find((acc) => acc.id === accountId)
    if (!account) {
      return { success: false, error: 'Account not found' }
    }

    const partition = `persist:fb-${accountId}`
    const win = new BrowserWindow({
      width: 1200,
      height: 800,
      show: false,
      title: `${account.name} - Facebook`,
      webPreferences: {
        partition,
        preload: join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        sandbox: true
      }
    })

    // Try to restore session
    const statePath = join(STORAGE_DIR, `${accountId}.json`)
    try {
      const sessionData = await fs.readFile(statePath, 'utf-8')
      // Note: Electron doesn't have a direct loadStorageStateFromFile in newer versions
      // You may need to manually restore cookies/localStorage here
      console.log(`Found session for ${accountId}`)
    } catch (e) {
      console.log(`No saved session for ${accountId}`)
    }

    win.loadURL('https://www.facebook.com')

    win.once('ready-to-show', () => {
      win.show()
      console.log(`Window shown for account: ${account.name}`)
    })

    accountWindows.set(accountId, win)

    win.on('closed', () => {
      console.log(`Window closed for account: ${account.name}`)
      accountWindows.delete(accountId)
    })

    await updateAccountStatus(accountId, 'active')

    return { success: true, message: `Window opened for ${account.name}` }
  } catch (err: any) {
    console.error(`Error opening window for ${accountId}:`, err)
    return { success: false, error: err.message }
  }
}

ipcMain.handle('open-account-window', async (event, accountId: string) => {
  return await openSingleAccountWindow(accountId)
})

ipcMain.handle('close-account-window', async (event, accountId: string) => {
  const win = accountWindows.get(accountId)
  if (win && !win.isDestroyed()) {
    win.close()
    return { success: true }
  }
  return { success: false, error: 'Window not found' }
})

ipcMain.handle('save-account-session', async (event, accountId: string) => {
  try {
    const win = accountWindows.get(accountId)
    if (!win || win.isDestroyed()) {
      return { success: false, error: 'Window not found' }
    }

    const statePath = join(STORAGE_DIR, `${accountId}.json`)

    // Get cookies and save them
    const cookies = await win.webContents.session.cookies.get({})
    const sessionData = {
      cookies,
      timestamp: new Date().toISOString()
    }

    await fs.writeFile(statePath, JSON.stringify(sessionData, null, 2))

    return { success: true, message: 'Session saved' }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

// ====================== AUTO-LOGIN ======================

// Helper function to auto-login a single account

/* --------------------------
   Utilities
--------------------------- */

const wait = (ms: number): Promise<void> => new Promise<void>((resolve) => setTimeout(resolve, ms))

async function waitForLoad(wc: WebContents, timeout = 30000): Promise<void> {
  return new Promise<void>((resolve) => {
    const handler = (): void => {
      wc.off('did-finish-load', handler)
      resolve()
    }

    wc.on('did-finish-load', handler)

    setTimeout(() => {
      wc.off('did-finish-load', handler)
      resolve()
    }, timeout)
  })
}

async function waitForSelector(
  wc: WebContents,
  selector: string,
  timeout = 10000
): Promise<boolean> {
  const start = Date.now()

  while (Date.now() - start < timeout) {
    const exists = await wc.executeJavaScript(
      `!!document.querySelector(${JSON.stringify(selector)})`,
      true
    )

    if (exists) return true
    await wait(500)
  }
  // id="_R_1h6kqsqppb6amH1_"

  return false
}

async function typeLikeHuman(wc: WebContents, text: string): Promise<void> {
  wc.focus()
  console.log('running type like human', text)

  for (const char of text) {
    wc.sendInputEvent({ type: 'keyDown', keyCode: char })
    await wait(30)

    wc.sendInputEvent({ type: 'char', keyCode: char })
    await wait(30)

    wc.sendInputEvent({ type: 'keyUp', keyCode: char })
    await wait(50 + Math.random() * 100)
  }
}

async function clickElementBySelector(wc: WebContents, selector: string): Promise<boolean> {
  console.log('[CLICK] Selector:', selector)

  const result = (await wc.executeJavaScript(
    `
    (function() {
      const el = document.querySelector("${selector.replace(/"/g, '\\"')}");
      if (!el) {
        console.log('[CLICK-DEBUG] Element not found');
        return false;
      }

      // Scroll into view if needed
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });

      // Give a tiny delay for scroll/focus
      setTimeout(() => {
        // Dispatch real MouseEvent (more reliable than .click() sometimes)
        const clickEvent = new MouseEvent('click', {
          view: window,
          bubbles: true,
          cancelable: true,
          button: 0
        });
        el.dispatchEvent(clickEvent);

        // Also try native .click() as fallback
        el.click();
      }, 300);

      console.log('[CLICK-DEBUG] Click dispatched on element');
      return true;
    })();
    `,
    true
  )) as boolean

  if (result) {
    console.log('[CLICK] JS click dispatched successfully')
  } else {
    console.warn('[CLICK] Element not found or click failed')
  }

  return result
}

/* --------------------------
   Main Function
--------------------------- */

export async function autoLoginSingleAccount(
  accountId: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const accounts = await loadAccounts()
    const account = accounts.find((acc) => acc.id === accountId)
    if (!account) {
      return { success: false, error: 'Account not found' }
    }
    const { password, username } = account
    console.log('username:', username, 'password:', password)

    let win = accountWindows.get(accountId)

    if (!win || win.isDestroyed()) {
      win = new BrowserWindow({
        width: 1000,
        height: 800,
        webPreferences: {
          contextIsolation: false,
          nodeIntegration: false
        }
      })

      accountWindows.set(accountId, win)
    }

    const wc = win.webContents

    // Navigate to YOUR OWN login page
    await wc.loadURL('http://facebook.com/login')

    await waitForLoad(wc)

    // Wait for fields
    const emailReady = await waitForSelector(wc, 'input[name="email"]')
    const passReady = await waitForSelector(wc, 'input[name="pass"]')
    const btnReady = await waitForSelector(
      wc,
      'button[name="login"],[aria-label="Log in"], button[data-testid="royal_login_button"], button[type="submit"]'
    )

    // aria-label="Log in"
    console.log('fields', emailReady, passReady, btnReady)

    if (!emailReady || !passReady || !btnReady) {
      return { success: false, error: 'Login form not found' }
    }

    // Focus email
    await wc.executeJavaScript(`document.querySelector('input[name="email"]').focus()`, true)

    await wait(500)

    // Clear email
    wc.sendInputEvent({ type: 'keyDown', keyCode: 'A', modifiers: ['control'] })
    wc.sendInputEvent({ type: 'keyUp', keyCode: 'A', modifiers: ['control'] })
    wc.sendInputEvent({ type: 'keyDown', keyCode: 'Delete' })
    wc.sendInputEvent({ type: 'keyUp', keyCode: 'Delete' })

    await typeLikeHuman(wc, username)

    await wait(800)

    // Focus password
    await wc.executeJavaScript(`document.querySelector('input[name="pass"]').focus()`, true)

    await wait(500)

    wc.sendInputEvent({ type: 'keyDown', keyCode: 'A', modifiers: ['control'] })
    wc.sendInputEvent({ type: 'keyUp', keyCode: 'A', modifiers: ['control'] })
    wc.sendInputEvent({ type: 'keyDown', keyCode: 'Delete' })
    wc.sendInputEvent({ type: 'keyUp', keyCode: 'Delete' })

    await typeLikeHuman(wc, password)

    await wait(800)

    const clicked = await clickElementBySelector(wc, '[aria-label="Log in"]')
    console.log('Button clicked:', clicked)

    if (!clicked) {
      return { success: false, error: 'Login button not clickable' }
    }

    await wait(3000)

    return { success: true, message: 'Login automation complete' }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

ipcMain.handle('auto-login-account', async (event, accountId: string) => {
  return await autoLoginSingleAccount(accountId)
})

// ====================== BULK OPERATIONS ======================

ipcMain.handle('bulk-open-accounts', async (event, accountIds: string[]) => {
  console.log(`Starting bulk open for ${accountIds.length} accounts`)
  const results = []

  for (let i = 0; i < accountIds.length; i++) {
    const id = accountIds[i]
    console.log(`Opening account ${i + 1}/${accountIds.length}: ${id}`)

    try {
      const result = await openSingleAccountWindow(id)
      results.push({
        id,
        success: result.success,
        message: result.message,
        error: result.error
      })

      console.log(`Result for ${id}:`, result)

      // Stagger window opening to avoid overwhelming the system
      if (i < accountIds.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1500))
      }
    } catch (err: any) {
      console.error(`Error opening ${id}:`, err)
      results.push({
        id,
        success: false,
        error: err.message
      })
    }
  }

  const successCount = results.filter((r) => r.success).length
  console.log(`Bulk open completed: ${successCount}/${accountIds.length} successful`)

  return {
    success: true,
    results,
    summary: `Opened ${successCount}/${accountIds.length} accounts`
  }
})

ipcMain.handle('bulk-login-accounts', async (event, accountIds: string[]) => {
  console.log(`Starting bulk login for ${accountIds.length} accounts`)
  const results = []

  for (let i = 0; i < accountIds.length; i++) {
    const id = accountIds[i]
    console.log(`Logging in account ${i + 1}/${accountIds.length}: ${id}`)

    try {
      const result = await autoLoginSingleAccount(id)
      results.push({
        id,
        success: result.success,
        message: result.message,
        error: result.error
      })

      console.log(`Login result for ${id}:`, result)

      // Stagger logins significantly to avoid rate limiting
      if (i < accountIds.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 8000))
      }
    } catch (err: any) {
      console.error(`Error logging in ${id}:`, err)
      results.push({
        id,
        success: false,
        error: err.message
      })
    }
  }

  const successCount = results.filter((r) => r.success).length
  console.log(`Bulk login completed: ${successCount}/${accountIds.length} successful`)

  return {
    success: true,
    results,
    summary: `Logged in ${successCount}/${accountIds.length} accounts`
  }
})

// ====================== UTILITIES ======================

ipcMain.handle('get-window-status', async () => {
  const status = Array.from(accountWindows.entries()).map(([id, win]) => ({
    accountId: id,
    isOpen: !win.isDestroyed(),
    url: win.isDestroyed() ? null : win.webContents.getURL()
  }))
  return { success: true, windows: status }
})

ipcMain.handle('export-accounts', async () => {
  try {
    const accounts = await loadAccounts()
    return { success: true, data: JSON.stringify(accounts, null, 2) }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('import-accounts', async (event, jsonData: string) => {
  try {
    const imported = JSON.parse(jsonData) as Account[]
    const existing = await loadAccounts()

    const merged = [...existing]
    let importedCount = 0

    for (const acc of imported) {
      if (!merged.find((e) => e.username === acc.username)) {
        merged.push({
          ...acc,
          id: `acc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          status: 'inactive'
        })
        importedCount++
      }
    }

    await saveAccounts(merged)
    return { success: true, imported: importedCount }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})
