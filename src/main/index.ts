import { app, shell, BrowserWindow, ipcMain, BrowserView } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import * as fs from 'fs/promises'
import {
  wait,
  waitForLoad,
  waitForSelector,
  typeLikeHuman,
  clickElementBySelector
} from '../Utils/index'

let mainWindow: BrowserWindow | null = null
const accountBrowserViews = new Map<string, BrowserView>()
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

interface BrowserLayout {
  x: number
  y: number
  width: number
  height: number
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

let currentScrollPosition = 0

// Update the calculateLayout function to account for scroll
function calculateLayout(
  index: number,
  total: number,
  windowWidth: number,
  windowHeight: number,
  scrollY: number = 0
): BrowserLayout {
  const TOP_HEADER_HEIGHT = 49
  const CONTROL_PANEL_WIDTH = 320
  const MARGIN = 10
  const BROWSER_WIDTH = 380
  const BROWSER_HEIGHT = 600

  // Available width (left side only, excluding control panel)
  const leftSideWidth = windowWidth - CONTROL_PANEL_WIDTH
  const availableWidth = leftSideWidth - MARGIN * 2

  // Calculate how many columns fit in the available width
  let cols = Math.max(1, Math.floor((availableWidth + MARGIN) / (BROWSER_WIDTH + MARGIN)))

  // Don't use more columns than we have browsers (until we have enough to fill a row)
  if (total < cols) {
    cols = total
  }

  // Calculate rows (this can be unlimited now since we're scrollable)
  const rows = Math.ceil(total / cols)

  // Calculate grid position (fills left to right, then top to bottom)
  const row = Math.floor(index / cols)
  const col = index % cols

  // Calculate pixel position - ADJUSTED FOR SCROLL
  const x = MARGIN + col * (BROWSER_WIDTH + MARGIN)
  const y = TOP_HEADER_HEIGHT + MARGIN + row * (BROWSER_HEIGHT + MARGIN) - scrollY

  // Only show browsers that are visible in the viewport
  const viewportHeight = windowHeight
  const isVisible = y + BROWSER_HEIGHT > 0 && y < viewportHeight

  return {
    x: x,
    y: Math.max(0, y), // Don't go negative
    width: BROWSER_WIDTH,
    height: BROWSER_HEIGHT
  }
}

// Update relayoutBrowserViews to use scroll position
function relayoutBrowserViews(): void {
  if (!mainWindow) return

  const bounds = mainWindow.getContentBounds()
  const accountIds = Array.from(accountBrowserViews.keys())

  accountIds.forEach((id, index) => {
    const view = accountBrowserViews.get(id)
    if (view) {
      const layout = calculateLayout(
        index,
        accountIds.length,
        bounds.width,
        bounds.height,
        currentScrollPosition
      )
      view.setBounds(layout)
    }
  })
}

// Add IPC handler for scroll updates
ipcMain.handle('update-scroll-position', async (event, scrollY: number) => {
  currentScrollPosition = scrollY
  relayoutBrowserViews()
  return { success: true }
})

// Add IPC handler to get total grid height
ipcMain.handle('get-grid-height', async () => {
  if (!mainWindow) return { success: false }

  const bounds = mainWindow.getContentBounds()
  const total = accountBrowserViews.size
  const CONTROL_PANEL_WIDTH = 320
  const BROWSER_WIDTH = 380
  const BROWSER_HEIGHT = 600
  const MARGIN = 20

  const leftSideWidth = bounds.width - CONTROL_PANEL_WIDTH
  const availableWidth = leftSideWidth - MARGIN * 3
  const cols = Math.max(1, Math.floor((availableWidth + MARGIN) / (BROWSER_WIDTH + MARGIN)))
  const rows = Math.ceil(total / cols)

  const totalHeight = 49 + MARGIN + rows * (BROWSER_HEIGHT + MARGIN)

  return { success: true, height: totalHeight, rows, cols }
})

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
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
    if (mainWindow) {
      mainWindow.maximize()
    }
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

  // Handle window resize - relayout browser views
  mainWindow.on('resize', () => {
    relayoutBrowserViews()
  })

  mainWindow.on('closed', () => {
    // Clean up all browser views
    accountBrowserViews.forEach((view) => {
      if (mainWindow) {
        mainWindow.removeBrowserView(view)
      }
    })
    accountBrowserViews.clear()
  })
}

// Relayout all browser views when window resizes
// function relayoutBrowserViews(): void {
//   if (!mainWindow) return

//   const bounds = mainWindow.getContentBounds()
//   const accountIds = Array.from(accountBrowserViews.keys())

//   accountIds.forEach((id, index) => {
//     const view = accountBrowserViews.get(id)
//     if (view) {
//       const layout = calculateLayout(index, accountIds.length, bounds.width, bounds.height)
//       view.setBounds(layout)
//     }
//   })
// }

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

    // Remove browser view
    const view = accountBrowserViews.get(accountId)
    if (view && mainWindow) {
      mainWindow.removeBrowserView(view)
      accountBrowserViews.delete(accountId)
      relayoutBrowserViews()
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

// ====================== BROWSER VIEW MANAGEMENT ======================

async function createBrowserViewForAccount(
  accountId: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    if (!mainWindow) {
      return { success: false, error: 'Main window not available' }
    }

    // Check if view already exists
    if (accountBrowserViews.has(accountId)) {
      return { success: true, message: 'Browser view already exists' }
    }

    const accounts = await loadAccounts()
    const account = accounts.find((acc) => acc.id === accountId)
    if (!account) {
      return { success: false, error: 'Account not found' }
    }

    const partition = `persist:fb-${accountId}`
    const view = new BrowserView({
      webPreferences: {
        partition,
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false
      }
    })

    mainWindow.addBrowserView(view)
    accountBrowserViews.set(accountId, view)

    // Calculate position in LEFT SIDE ONLY
    const bounds = mainWindow.getContentBounds()
    const index = accountBrowserViews.size - 1
    const layout = calculateLayout(index, accountBrowserViews.size, bounds.width, bounds.height)

    console.log(`Setting browser view bounds for ${account.name}:`, layout)
    view.setBounds(layout)
    view.setAutoResize({ width: false, height: false })

    // Load Facebook
    view.webContents.loadURL('https://www.facebook.com')

    await updateAccountStatus(accountId, 'active')

    // Relayout all views to fit the new one
    relayoutBrowserViews()

    console.log(`Browser view created for: ${account.name}`)
    return { success: true, message: `Browser opened for ${account.name}` }
  } catch (err: any) {
    console.error(`Error creating browser view for ${accountId}:`, err)
    return { success: false, error: err.message }
  }
}

ipcMain.handle('open-account-window', async (event, accountId: string) => {
  return await createBrowserViewForAccount(accountId)
})

ipcMain.handle('close-account-window', async (event, accountId: string) => {
  try {
    const view = accountBrowserViews.get(accountId)
    if (view && mainWindow) {
      mainWindow.removeBrowserView(view)
      accountBrowserViews.delete(accountId)
      relayoutBrowserViews()
      await updateAccountStatus(accountId, 'inactive')
      return { success: true }
    }
    return { success: false, error: 'Browser view not found' }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('close-all-browsers', async () => {
  try {
    if (!mainWindow) {
      return { success: false, error: 'Main window not available' }
    }

    accountBrowserViews.forEach((view, accountId) => {
      mainWindow!.removeBrowserView(view)
    })

    accountBrowserViews.clear()

    return { success: true, message: 'All browsers closed' }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('save-account-session', async (event, accountId: string) => {
  try {
    const view = accountBrowserViews.get(accountId)
    if (!view) {
      return { success: false, error: 'Browser view not found' }
    }

    const statePath = join(STORAGE_DIR, `${accountId}.json`)
    const cookies = await view.webContents.session.cookies.get({})
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

async function autoLoginSingleAccount(
  accountId: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const accounts = await loadAccounts()
    const account = accounts.find((acc) => acc.id === accountId)

    if (!account) {
      return { success: false, error: 'Account not found' }
    }

    console.log(`Starting auto-login for: ${account.name}`)

    /* -------------------------------
       Get or Create BrowserView
    --------------------------------*/

    let view = accountBrowserViews.get(accountId)

    if (!view) {
      console.log(`Creating browser view for ${account.name}`)

      const createResult = await createBrowserViewForAccount(accountId)

      if (!createResult.success) {
        return {
          success: false,
          error: `Failed to create browser: ${createResult.error}`
        }
      }

      await wait(2000)

      view = accountBrowserViews.get(accountId)
    }

    if (!view) {
      return { success: false, error: 'Failed to get browser view' }
    }

    const wc = view.webContents

    /* -------------------------------
       Navigate to Login Page
    --------------------------------*/

    console.log(`Navigating to login page for ${account.name}`)

    await wc.loadURL('https://www.facebook.com/login')

    await waitForLoad(wc)

    await wait(2000)

    /* -------------------------------
       Wait for Login Fields
    --------------------------------*/

    const emailSelector = '#email, input[name="email"], input[type="text"]'

    const passSelector = '#pass, input[name="pass"], input[type="password"]'

    const buttonSelector =
      '[name="login"], [data-testid="royal_login_button"], button[type="submit"]'

    const emailFound = await waitForSelector(wc, emailSelector)

    if (!emailFound) {
      return { success: false, error: 'Email field not found' }
    }

    const passFound = await waitForSelector(wc, passSelector)

    if (!passFound) {
      return { success: false, error: 'Password field not found' }
    }

    console.log('Login fields detected')

    /* -------------------------------
       Focus Email Field
    --------------------------------*/

    await wc.executeJavaScript(`
      const el = document.querySelector(${JSON.stringify(emailSelector)});
      if (el) el.focus();
    `)

    await wait(500)

    /* -------------------------------
       Clear Existing Email
    --------------------------------*/

    wc.sendInputEvent({ type: 'keyDown', keyCode: 'A', modifiers: ['control'] })
    wc.sendInputEvent({ type: 'keyUp', keyCode: 'A', modifiers: ['control'] })

    wc.sendInputEvent({ type: 'keyDown', keyCode: 'Delete' })
    wc.sendInputEvent({ type: 'keyUp', keyCode: 'Delete' })

    await wait(300)

    /* -------------------------------
       Type Email
    --------------------------------*/

    await typeLikeHuman(wc, account.username)

    await wait(800)

    /* -------------------------------
       Focus Password Field
    --------------------------------*/

    await wc.executeJavaScript(`document.querySelector('input[name="pass"]').focus()`, true)

    await wait(500)

    /* -------------------------------
       Clear Password
    --------------------------------*/

    wc.sendInputEvent({ type: 'keyDown', keyCode: 'A', modifiers: ['control'] })
    wc.sendInputEvent({ type: 'keyUp', keyCode: 'A', modifiers: ['control'] })

    wc.sendInputEvent({ type: 'keyDown', keyCode: 'Delete' })
    wc.sendInputEvent({ type: 'keyUp', keyCode: 'Delete' })

    await wait(300)

    /* -------------------------------
       Type Password
    --------------------------------*/

    await typeLikeHuman(wc, account.password)

    await wait(800)

    /* -------------------------------
       Click Login Button
    --------------------------------*/

    const clicked = await clickElementBySelector(wc, '[aria-label="Log in"]')
    console.log('Button clicked:', clicked)

    if (!clicked) {
      return { success: false, error: 'Login button not clickable' }
    }

    await wait(3000)

    /* -------------------------------
       Wait for Login Processing
    --------------------------------*/

    await updateAccountStatus(accountId, 'logged-in')

    console.log(`Successfully logged in: ${account.name}`)

    return {
      success: true,
      message: `Logged in: ${account.name}`
    }
  } catch (err: any) {
    console.error(`Auto-login error for ${accountId}:`, err)

    await updateAccountStatus(accountId, 'error')

    return {
      success: false,
      error: err.message
    }
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
      const result = await createBrowserViewForAccount(id)
      results.push({
        id,
        success: result.success,
        message: result.message,
        error: result.error
      })

      console.log(`Result for ${id}:`, result)

      if (i < accountIds.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500))
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

// ipcMain.handle(
//   'bulk-account-like',
//   async (event, { accountIds,  }: { accountIds: string[]; }) => {
//     console.log(`Starting bulk like for ${accountIds.length} `)
//     const results = [] as Array<{ id: string; success: boolean; message?: string; error?: string }>

//     for (let i = 0; i < accountIds.length; i++) {
//       const id = accountIds[i]
//       console.log(`Liking page for account ${i + 1}/${accountIds.length}: ${id}`)

//       try {
//         const view = accountBrowserViews.get(id)
//         if (!view) {
//           results.push({ id, success: false, error: 'Browser view not found' })
//           continue
//         }

//         await waitForLoad(view.webContents)

//         const likeClicked = await clickElementBySelector(view.webContents, '[aria-label="Like"]')

//         console.log('button was clieked or not', likeClicked)

//         if (likeClicked) {
//           results.push({ id, success: true, message: 'Page liked' })
//         } else {
//           results.push({ id, success: false, error: 'Like button not found' })
//         }
//       } catch (err: any) {
//         console.error(`Error liking page for ${id}:`, err)
//         results.push({ id, success: false, error: err.message })
//       }
//     }

//     const successCount = results.filter((r) => r.success).length
//     console.log(`Bulk like completed: ${successCount}/${accountIds.length} successful`)

//     return {
//       success: true,
//       results,
//       summary: `Liked page for ${successCount}/${accountIds.length} accounts`
//     }
//   }
// )

// ====================== BROWSER ACTIONS ======================

ipcMain.handle(
  'execute-action-on-account',
  async (event, { accountId, action }: { accountId: string; action: any }) => {
    try {
      const view = accountBrowserViews.get(accountId)
      if (!view) {
        return { success: false, error: 'Browser view not found' }
      }

      const wc = view.webContents

      switch (action.type) {
        case 'navigate':
          if (action.url) {
            wc.loadURL(action.url)
            await new Promise((resolve) => setTimeout(resolve, 2000))
            return { success: true, result: 'Navigated' }
          }
          break

        case 'executeScript':
          if (action.script) {
            const result = await wc.executeJavaScript(action.script, true)
            return { success: true, result }
          }
          break

        case 'click':
          if (action.selector) {
            const result = await wc.executeJavaScript(
              `
            const element = document.querySelector('${action.selector}');
            if (element) {
              element.click();
              true;
            } else {
              false;
            }
          `,
              true
            )
            return { success: result, result: result ? 'Clicked' : 'Element not found' }
          }
          break

        case 'scroll':
          const scrollResult = await wc.executeJavaScript(
            `
          window.scrollBy(0, ${action.value || 500});
          true;
        `,
            true
          )
          return { success: true, result: 'Scrolled' }

        case 'wait':
          await new Promise((resolve) => setTimeout(resolve, action.delay || 1000))
          return { success: true, result: 'Waited' }

        default:
          return { success: false, error: 'Unknown action type' }
      }

      return { success: false, error: 'Action not executed' }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }
)

ipcMain.handle('execute-action-on-all-accounts', async (event, action: any) => {
  const results = []

  for (const [accountId, view] of accountBrowserViews.entries()) {
    try {
      const result = await ipcMain.emit('execute-action-on-account', event, { accountId, action })
      results.push({ accountId, ...result })
    } catch (err: any) {
      results.push({ accountId, success: false, error: err.message })
    }
  }

  return { success: true, results }
})

ipcMain.handle(
  'navigate-account-to',
  async (event, { accountId, url }: { accountId: string; url: string }) => {
    try {
      const view = accountBrowserViews.get(accountId)
      if (!view) {
        return { success: false, error: 'Browser view not found' }
      }

      view.webContents.loadURL(url)
      await new Promise((resolve) => setTimeout(resolve, 2000))

      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }
)

ipcMain.handle('navigate-all-accounts-to', async (event, url: string) => {
  const results = []

  for (const [accountId, view] of accountBrowserViews.entries()) {
    try {
      view.webContents.loadURL(url)
      results.push({ accountId, success: true })
    } catch (err: any) {
      results.push({ accountId, success: false, error: err.message })
    }
  }

  await new Promise((resolve) => setTimeout(resolve, 3000))

  return { success: true, results }
})

ipcMain.handle('get-active-browsers', async () => {
  const accountIds = Array.from(accountBrowserViews.keys())
  return { success: true, accountIds }
})

// ====================== UTILITIES ======================

ipcMain.handle('get-window-status', async () => {
  const status = Array.from(accountBrowserViews.entries()).map(([id, view]) => ({
    accountId: id,
    isOpen: true,
    url: view.webContents.getURL()
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

// ====================== ENHANCED BROWSER ACTIONS ======================

// Auto-scroll a single account continuously
ipcMain.handle(
  'scroll-account',
  async (event, { accountId, duration = 30000 }: { accountId: string; duration?: number }) => {
    try {
      const view = accountBrowserViews.get(accountId)
      if (!view) {
        return { success: false, error: 'Browser view not found' }
      }

      // Execute scrolling script that runs for specified duration
      await view.webContents.executeJavaScript(
        `
      (async () => {
        let scrollCount = 0;
        const maxScrolls = ${Math.floor(duration / 3000)};

        const scrollInterval = setInterval(() => {
          window.scrollBy(0, 500);
          scrollCount++;

          if (scrollCount >= maxScrolls) {
            clearInterval(scrollInterval);
          }
        }, 3000);

        return { success: true, message: 'Scrolling started' };
      })();
      `,
        true
      )

      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }
)

// IMPROVED: Auto-scroll with better control
ipcMain.handle(
  'scroll-all-accounts',
  async (event, { duration = 30000, speed = 500 }: { duration?: number; speed?: number } = {}) => {
    const results = []

    for (const [accountId, view] of accountBrowserViews.entries()) {
      try {
        await view.webContents.executeJavaScript(
          `
        (async () => {
          let scrollCount = 0;
          const scrollAmount = ${speed};
          const interval = 3000; // Scroll every 3 seconds
          const maxScrolls = ${Math.floor(duration / 3000)};

          const scrollInterval = setInterval(() => {
            window.scrollBy({
              top: scrollAmount,
              behavior: 'smooth'
            });
            scrollCount++;
            console.log('[SCROLL] Scrolled', scrollCount, '/', maxScrolls);

            if (scrollCount >= maxScrolls) {
              clearInterval(scrollInterval);
              console.log('[SCROLL] Finished scrolling');
            }
          }, interval);

          return { success: true };
        })();
        `,
          true
        )
        results.push({ accountId, success: true })
      } catch (err: any) {
        results.push({ accountId, success: false, error: err.message })
      }
    }

    return { success: true, results }
  }
)

// Watch reels on single account
ipcMain.handle(
  'watch-reels-account',
  async (event, { accountId, duration = 60000 }: { accountId: string; duration?: number }) => {
    try {
      const view = accountBrowserViews.get(accountId)
      if (!view) {
        return { success: false, error: 'Browser view not found' }
      }

      // Navigate to reels
      view.webContents.loadURL('https://www.facebook.com/reel')
      await new Promise((resolve) => setTimeout(resolve, 3000))

      // Auto-watch reels by scrolling
      await view.webContents.executeJavaScript(
        `
      (async () => {
        console.log('[REELS] Starting to watch reels');

        const scrollInterval = setInterval(() => {
          // Scroll to next reel
          window.scrollBy(0, 700);
          console.log('[REELS] Scrolled to next reel');
        }, 5000); // Every 5 seconds

        // Stop after duration
        setTimeout(() => {
          clearInterval(scrollInterval);
          console.log('[REELS] Finished watching reels');
        }, ${duration});

        return { success: true };
      })();
      `,
        true
      )

      return { success: true, message: 'Watching reels' }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }
)

// IMPROVED: Watch reels with better navigation
ipcMain.handle(
  'watch-reels-all-accounts',
  async (event, { duration = 60000 }: { duration?: number } = {}) => {
    const results = []

    // First navigate all to reels
    for (const [accountId, view] of accountBrowserViews.entries()) {
      try {
        view.webContents.loadURL('https://www.facebook.com/reel')
        results.push({ accountId, success: true, action: 'navigated' })
      } catch (err: any) {
        results.push({ accountId, success: false, error: err.message })
      }
    }

    // Wait for all to load
    await wait(5000)

    // Start watching on all
    for (const [accountId, view] of accountBrowserViews.entries()) {
      try {
        await view.webContents.executeJavaScript(
          `
        (async () => {
          let watchedCount = 0;
          const watchDuration = ${duration};
          const reelInterval = 8000; // 8 seconds per reel
          const maxReels = Math.floor(watchDuration / reelInterval);

          console.log('[REELS] Starting to watch reels for', watchDuration / 1000, 'seconds');

          const watchInterval = setInterval(() => {
            // Scroll to next reel (vertical scroll for reels)
            window.scrollBy({
              top: 700,
              behavior: 'smooth'
            });

            watchedCount++;
            console.log('[REELS] Watching reel', watchedCount, '/', maxReels);

            if (watchedCount >= maxReels) {
              clearInterval(watchInterval);
              console.log('[REELS] Finished watching');
            }
          }, reelInterval);

          return { success: true };
        })();
        `,
          true
        )
      } catch (err: any) {
        console.error(`Failed to start watching reels on ${accountId}:`, err)
      }
    }

    return { success: true, results }
  }
)

// NEW: React to posts (Love, Haha, Wow, etc.)
ipcMain.handle(
  'react-to-posts',
  async (
    event,
    {
      accountId,
      reaction = 'love',
      count = 5
    }: { accountId: string; reaction?: string; count?: number }
  ) => {
    try {
      const view = accountBrowserViews.get(accountId)
      if (!view) {
        return { success: false, error: 'Browser view not found' }
      }

      // Reaction types: like, love, care, haha, wow, sad, angry
      const result = await view.webContents.executeJavaScript(
        `
      (async () => {
        let reactedCount = 0;
        const maxReacts = ${count};
        const reactionType = '${reaction}';

        console.log('[REACT] Starting to react with', reactionType);

        async function closeModals() {
          const closeButtons = document.querySelectorAll('[aria-label*="Close"], [aria-label*="close"]');
          closeButtons.forEach(btn => {
            try { btn.click(); } catch(e) {}
          });
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
        }

        async function reactToNextPost() {
          if (reactedCount >= maxReacts) {
            console.log('[REACT] Finished! Reacted to', reactedCount, 'posts');
            return;
          }

          await closeModals();
          await new Promise(r => setTimeout(r, 500));

          // Find "Like" buttons (unreacted posts)
          const likeButtons = Array.from(document.querySelectorAll('[aria-label="Like"]'));

          if (likeButtons.length > 0) {
            const button = likeButtons[0];
            button.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await new Promise(r => setTimeout(r, 500));

            // Long press to show reaction menu (hover effect)
            button.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
            await new Promise(r => setTimeout(r, 1000));

            // Click specific reaction or just like
            if (reactionType === 'like') {
              button.click();
            } else {
              // Try to find reaction button
              const reactionButtons = document.querySelectorAll('[aria-label*="' + reactionType + '"]');
              if (reactionButtons.length > 0) {
                reactionButtons[0].click();
              } else {
                button.click(); // Fallback to like
              }
            }

            reactedCount++;
            console.log('[REACT] Reacted to post #' + reactedCount);

            await new Promise(r => setTimeout(r, 1000));
            await closeModals();

            window.scrollBy(0, 300);
            await new Promise(r => setTimeout(r, 1500));

            setTimeout(() => reactToNextPost(), 2000);
          } else {
            window.scrollBy(0, 500);
            await new Promise(r => setTimeout(r, 2000));
            if (reactedCount < maxReacts) {
              setTimeout(() => reactToNextPost(), 2000);
            }
          }
        }

        reactToNextPost();
        return { success: true, message: 'Started reacting to posts...' };
      })();
      `,
        true
      )

      return result
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }
)

// NEW: View stories continuously
ipcMain.handle('view-stories-all', async (event, { count = 20 }: { count?: number } = {}) => {
  const results = []

  // Navigate all to stories
  for (const [accountId, view] of accountBrowserViews.entries()) {
    try {
      view.webContents.loadURL('https://www.facebook.com/stories')
      results.push({ accountId, success: true })
    } catch (err: any) {
      results.push({ accountId, success: false, error: err.message })
    }
  }

  await new Promise((resolve) => setTimeout(resolve, 4000))

  // Start viewing stories
  for (const [accountId, view] of accountBrowserViews.entries()) {
    try {
      await view.webContents.executeJavaScript(
        `
        (async () => {
          let viewedCount = 0;
          const maxStories = ${count};

          async function viewNextStory() {
            if (viewedCount >= maxStories) {
              console.log('[STORIES] Finished viewing', viewedCount, 'stories');
              return;
            }

            // Wait to view current story
            await new Promise(r => setTimeout(r, 3000));

            viewedCount++;
            console.log('[STORIES] Viewed story', viewedCount);

            // Click next button or right arrow
            const nextButton = document.querySelector('[aria-label*="Next"], [aria-label*="next"], .story-next-button');
            if (nextButton) {
              nextButton.click();
              setTimeout(() => viewNextStory(), 1000);
            } else {
              // Try clicking right side of screen
              const storyContainer = document.querySelector('[role="dialog"], .story-viewer');
              if (storyContainer) {
                const rect = storyContainer.getBoundingClientRect();
                const clickEvent = new MouseEvent('click', {
                  view: window,
                  bubbles: true,
                  cancelable: true,
                  clientX: rect.right - 50,
                  clientY: rect.top + rect.height / 2
                });
                storyContainer.dispatchEvent(clickEvent);
                setTimeout(() => viewNextStory(), 1000);
              }
            }
          }

          viewNextStory();
          return { success: true };
        })();
        `,
        true
      )
    } catch (err: any) {
      console.error(`Failed to view stories on ${accountId}:`, err)
    }
  }

  return { success: true, results }
})

// Like posts on single account - IMPROVED VERSION
ipcMain.handle(
  'like-posts-account',
  async (event, { accountId, count = 5 }: { accountId: string; count?: number }) => {
    try {
      const view = accountBrowserViews.get(accountId)
      if (!view) {
        return { success: false, error: 'Browser view not found' }
      }

      const result = await view.webContents.executeJavaScript(
        `
      (async () => {
        let likedCount = 0;
        const maxLikes = ${count};

        console.log('[LIKE] Starting to like posts, target:', maxLikes);

        async function closeModals() {
          // Close any open modals/dialogs
          const closeButtons = document.querySelectorAll('[aria-label*="Close"], [aria-label*="close"], [role="button"][aria-label*="Back"]');
          closeButtons.forEach(btn => {
            try {
              btn.click();
            } catch(e) {}
          });

          // Press Escape key to close modals
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
        }

        async function likeNextPost() {
          if (likedCount >= maxLikes) {
            console.log('[LIKE] Finished! Liked', likedCount, 'posts');
            return;
          }

          // Close any modals first
          await closeModals();
          await new Promise(r => setTimeout(r, 500));

          // Find unliked posts
          // Look for "Like" buttons that are NOT already liked
          const allLikeButtons = Array.from(document.querySelectorAll('[aria-label="Like"]'));

          console.log('[LIKE] Found', allLikeButtons.length, 'unliked posts');

          if (allLikeButtons.length > 0) {
            const button = allLikeButtons[0];

            // Scroll into view
            button.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await new Promise(r => setTimeout(r, 500));

            // Click the like button
            button.click();
            likedCount++;
            console.log('[LIKE] Liked post #' + likedCount);

            // Wait for like to register
            await new Promise(r => setTimeout(r, 1000));

            // Close any reaction selector or modal that might have appeared
            await closeModals();

            // Scroll down to find more posts
            window.scrollBy(0, 300);
            await new Promise(r => setTimeout(r, 1500));

            // Continue to next post
            setTimeout(() => likeNextPost(), 2000);
          } else {
            // No more unliked posts visible, scroll to find more
            console.log('[LIKE] No unliked posts found, scrolling...');
            window.scrollBy(0, 500);
            await new Promise(r => setTimeout(r, 2000));

            // Try again
            if (likedCount < maxLikes) {
              setTimeout(() => likeNextPost(), 2000);
            }
          }
        }

        // Start liking
        likeNextPost();

        return { success: true, message: 'Started liking posts...' };
      })();
      `,
        true
      )

      return result
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }
)

// Like posts on all accounts - IMPROVED VERSION
ipcMain.handle('like-posts-all-accounts', async (event, { count = 5 }: { count?: number } = {}) => {
  const results = []

  for (const [accountId, view] of accountBrowserViews.entries()) {
    try {
      await view.webContents.executeJavaScript(
        `
        (async () => {
          let likedCount = 0;
          const maxLikes = ${count};

          async function closeModals() {
            const closeButtons = document.querySelectorAll('[aria-label*="Close"], [aria-label*="close"], [role="button"][aria-label*="Back"]');
            closeButtons.forEach(btn => {
              try { btn.click(); } catch(e) {}
            });
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
          }

          async function likeNextPost() {
            if (likedCount >= maxLikes) return;

            await closeModals();
            await new Promise(r => setTimeout(r, 500));

            const allLikeButtons = Array.from(document.querySelectorAll('[aria-label="Like"]'));

            if (allLikeButtons.length > 0) {
              const button = allLikeButtons[0];
              button.scrollIntoView({ behavior: 'smooth', block: 'center' });
              await new Promise(r => setTimeout(r, 500));

              button.click();
              likedCount++;

              await new Promise(r => setTimeout(r, 1000));
              await closeModals();

              window.scrollBy(0, 300);
              await new Promise(r => setTimeout(r, 1500));

              setTimeout(() => likeNextPost(), 2000);
            } else {
              window.scrollBy(0, 500);
              await new Promise(r => setTimeout(r, 2000));
              if (likedCount < maxLikes) {
                setTimeout(() => likeNextPost(), 2000);
              }
            }
          }

          likeNextPost();
          return { success: true };
        })();
        `,
        true
      )
      results.push({ accountId, success: true })
    } catch (err: any) {
      results.push({ accountId, success: false, error: err.message })
    }
  }

  return { success: true, results }
})

// Comment on posts
// ipcMain.handle(
//   'comment-on-posts',
//   async (
//     event,
//     { accountId, comment, count = 3 }: { accountId: string; comment: string; count?: number }
//   ) => {
//     try {
//       const view = accountBrowserViews.get(accountId)
//       if (!view) {
//         return { success: false, error: 'Browser view not found' }
//       }

//       const result = await view.webContents.executeJavaScript(
//         `
//       (async () => {
//         let commentedCount = 0;
//         const maxComments = ${count};
//         const commentText = '${comment.replace(/'/g, "\\'")}';

//         async function commentOnNextPost() {
//           // Find comment button
//           const commentButtons = Array.from(document.querySelectorAll('[aria-label*="Comment"]:not(.commented), [aria-label*="comment"]:not(.commented)'));

//           if (commentButtons.length > 0 && commentedCount < maxComments) {
//             const button = commentButtons[0];
//             button.click();
//             button.classList.add('commented');

//             // Wait for comment box to appear
//             await new Promise(r => setTimeout(r, 1000));

//             // Find comment input
//             const commentInput = document.querySelector('[aria-label*="Write a comment"], textarea[placeholder*="comment" i]');

//             if (commentInput) {
//               commentInput.focus();
//               commentInput.value = commentText;
//               commentInput.dispatchEvent(new Event('input', { bubbles: true }));

//               // Find and click post button
//               await new Promise(r => setTimeout(r, 500));
//               const postButton = document.querySelector('[aria-label*="Post comment"], button[type="submit"]');
//               if (postButton) {
//                 postButton.click();
//                 commentedCount++;
//                 console.log('[COMMENT] Posted comment', commentedCount);
//               }
//             }

//             // Scroll and continue
//             window.scrollBy(0, 500);
//             setTimeout(() => commentOnNextPost(), 5000);
//           }
//         }

//         commentOnNextPost();
//         return { success: true, message: 'Commenting on posts...' };
//       })();
//       `,
//         true
//       )

//       return result
//     } catch (err: any) {
//       return { success: false, error: err.message }
//     }
//   }
// )

// // Share posts
// ipcMain.handle(
//   'share-posts-account',
//   async (event, { accountId, count = 3 }: { accountId: string; count?: number }) => {
//     try {
//       const view = accountBrowserViews.get(accountId)
//       if (!view) {
//         return { success: false, error: 'Browser view not found' }
//       }

//       const result = await view.webContents.executeJavaScript(
//         `
//       (async () => {
//         let sharedCount = 0;
//         const maxShares = ${count};

//         async function shareNextPost() {
//           const shareButtons = Array.from(document.querySelectorAll('[aria-label*="Share"]:not(.shared), [aria-label*="share"]:not(.shared)'));

//           if (shareButtons.length > 0 && sharedCount < maxShares) {
//             const button = shareButtons[0];
//             button.click();
//             button.classList.add('shared');

//             // Wait for share menu
//             await new Promise(r => setTimeout(r, 1000));

//             // Click "Share Now" or first share option
//             const shareNowButton = document.querySelector('[aria-label*="Share now"], [role="menuitem"]');
//             if (shareNowButton) {
//               shareNowButton.click();
//               sharedCount++;
//               console.log('[SHARE] Shared post', sharedCount);
//             }

//             window.scrollBy(0, 500);
//             setTimeout(() => shareNextPost(), 4000);
//           }
//         }

//         shareNextPost();
//         return { success: true, message: 'Sharing posts...' };
//       })();
//       `,
//         true
//       )

//       return result
//     } catch (err: any) {
//       return { success: false, error: err.message }
//     }
//   }
// )

// Follow/Add friends
ipcMain.handle(
  'follow-people-account',
  async (event, { accountId, count = 5 }: { accountId: string; count?: number }) => {
    try {
      const view = accountBrowserViews.get(accountId)
      if (!view) {
        return { success: false, error: 'Browser view not found' }
      }

      const result = await view.webContents.executeJavaScript(
        `
      (async () => {
        let followedCount = 0;
        const maxFollows = ${count};

        async function followNext() {
          const followButtons = Array.from(document.querySelectorAll('[aria-label*="Add Friend"]:not(.followed), [aria-label*="Follow"]:not(.followed)'));

          if (followButtons.length > 0 && followedCount < maxFollows) {
            const button = followButtons[0];
            button.click();
            button.classList.add('followed');
            followedCount++;
            console.log('[FOLLOW] Followed user', followedCount);

            window.scrollBy(0, 500);
            setTimeout(() => followNext(), 3000);
          }
        }

        followNext();
        return { success: true, message: 'Following people...' };
      })();
      `,
        true
      )

      return result
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }
)

// React to stories
ipcMain.handle(
  'react-to-stories',
  async (event, { accountId, count = 10 }: { accountId: string; count?: number }) => {
    try {
      const view = accountBrowserViews.get(accountId)
      if (!view) {
        return { success: false, error: 'Browser view not found' }
      }

      // Navigate to stories
      view.webContents.loadURL('https://www.facebook.com/stories')
      await new Promise((resolve) => setTimeout(resolve, 3000))

      const result = await view.webContents.executeJavaScript(
        `
      (async () => {
        let reactedCount = 0;
        const maxReacts = ${count};

        async function reactToStory() {
          if (reactedCount < maxReacts) {
            // Click like/react button on story
            const reactButton = document.querySelector('[aria-label*="Like"], [aria-label*="React"]');
            if (reactButton) {
              reactButton.click();
              reactedCount++;
              console.log('[STORY] Reacted to story', reactedCount);
            }

            // Wait a bit
            await new Promise(r => setTimeout(r, 2000));

            // Click next story
            const nextButton = document.querySelector('[aria-label*="Next"], .next-story-button');
            if (nextButton) {
              nextButton.click();
              setTimeout(() => reactToStory(), 3000);
            }
          }
        }

        reactToStory();
        return { success: true, message: 'Reacting to stories...' };
      })();
      `,
        true
      )

      return result
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }
)

// Auto-view videos (watch)
ipcMain.handle(
  'watch-videos-account',
  async (event, { accountId, duration = 120000 }: { accountId: string; duration?: number }) => {
    try {
      const view = accountBrowserViews.get(accountId)
      if (!view) {
        return { success: false, error: 'Browser view not found' }
      }

      // Navigate to watch
      view.webContents.loadURL('https://www.facebook.com/watch')
      await new Promise((resolve) => setTimeout(resolve, 3000))

      // Auto-watch videos
      await view.webContents.executeJavaScript(
        `
      (async () => {
        let watchedTime = 0;
        const maxDuration = ${duration};

        const watchInterval = setInterval(() => {
          // Scroll to load more videos
          window.scrollBy(0, 800);
          watchedTime += 10000;

          if (watchedTime >= maxDuration) {
            clearInterval(watchInterval);
          }
        }, 10000); // Every 10 seconds

        return { success: true, message: 'Watching videos...' };
      })();
      `,
        true
      )

      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }
)

// Stop all actions on account
ipcMain.handle('stop-all-actions-account', async (event, accountId: string) => {
  try {
    const view = accountBrowserViews.get(accountId)
    if (!view) {
      return { success: false, error: 'Browser view not found' }
    }

    // Clear all intervals and timeouts
    await view.webContents.executeJavaScript(
      `
      // Clear all intervals
      for (let i = 1; i < 99999; i++) {
        window.clearInterval(i);
        window.clearTimeout(i);
      }

      console.log('[STOP] All actions stopped');
      'Actions stopped';
      `,
      true
    )

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

// Stop all actions on all accounts
ipcMain.handle('stop-all-actions', async () => {
  const results = []

  for (const [accountId, view] of accountBrowserViews.entries()) {
    try {
      await view.webContents.executeJavaScript(
        `
        for (let i = 1; i < 99999; i++) {
          window.clearInterval(i);
          window.clearTimeout(i);
        }
        'Stopped';
        `,
        true
      )
      results.push({ accountId, success: true })
    } catch (err: any) {
      results.push({ accountId, success: false, error: err.message })
    }
  }

  return { success: true, results }
})

// ====================== COMMENT ACTIONS ======================

// Comment on posts - ULTRA ROBUST VERSION
ipcMain.handle(
  'comment-on-posts',
  async (
    event,
    { accountId, comment, count = 3 }: { accountId: string; comment: string; count?: number }
  ) => {
    try {
      const view = accountBrowserViews.get(accountId)
      if (!view) {
        return { success: false, error: 'Browser view not found' }
      }

      const result = await view.webContents.executeJavaScript(
        `
      (async () => {
        let commentedCount = 0;
        const maxComments = ${count};
        const commentText = \`${comment.replace(/`/g, '\\`').replace(/'/g, "\\'").replace(/\n/g, '\\n')}\`;

        console.log('[COMMENT] ========== STARTING COMMENT PROCESS ==========');
        console.log('[COMMENT] Target:', maxComments, 'comments');
        console.log('[COMMENT] Text:', commentText);

        async function closeModals() {
          const closeButtons = document.querySelectorAll('[aria-label*="Close"], [aria-label*="close"]');
          closeButtons.forEach(btn => {
            try { btn.click(); } catch(e) {}
          });
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
        }

        async function findCommentButton() {
          console.log('[COMMENT] Searching for comment buttons...');

          // Method 1: By aria-label containing "Comment"
          let buttons = Array.from(document.querySelectorAll('[aria-label*="Comment"]'));
          console.log('[COMMENT] Method 1 (aria-label): Found', buttons.length, 'elements');

          // Filter to only actual buttons
          buttons = buttons.filter(btn => {
            const role = btn.getAttribute('role');
            const tag = btn.tagName.toLowerCase();
            const ariaLabel = btn.getAttribute('aria-label') || '';

            // Must be a button and specifically "Comment" action (not "Comment as...")
            const isCommentButton = (role === 'button' || tag === 'button') &&
                                   (ariaLabel === 'Comment' ||
                                    ariaLabel.startsWith('Comment on') ||
                                    ariaLabel.includes('Leave a comment'));

            return isCommentButton && !btn.classList.contains('commented');
          });

          console.log('[COMMENT] Filtered to', buttons.length, 'actual comment buttons');

          if (buttons.length > 0) {
            return buttons[0];
          }

          // Method 2: Find by text content
          const allButtons = Array.from(document.querySelectorAll('div[role="button"], button, span[role="button"]'));
          console.log('[COMMENT] Method 2: Checking', allButtons.length, 'total buttons');

          for (const btn of allButtons) {
            const text = (btn.textContent || '').trim();
            const ariaLabel = btn.getAttribute('aria-label') || '';

            if ((text === 'Comment' || ariaLabel === 'Comment') && !btn.classList.contains('commented')) {
              console.log('[COMMENT] Found via text/label match');
              return btn;
            }
          }

          // Method 3: Look for SVG icons (Facebook uses these)
          const svgButtons = Array.from(document.querySelectorAll('svg')).map(svg => {
            // Get parent button element
            let parent = svg.parentElement;
            while (parent && parent.getAttribute('role') !== 'button' && parent.tagName !== 'BUTTON') {
              parent = parent.parentElement;
              if (!parent || parent === document.body) break;
            }
            return parent;
          }).filter(btn => {
            if (!btn) return false;
            const ariaLabel = btn.getAttribute('aria-label') || '';
            const text = btn.textContent || '';
            return (ariaLabel.includes('Comment') || text.includes('Comment')) && !btn.classList.contains('commented');
          });

          console.log('[COMMENT] Method 3 (SVG): Found', svgButtons.length, 'buttons');

          if (svgButtons.length > 0) {
            return svgButtons[0];
          }

          console.log('[COMMENT] ❌ Could not find any comment button');
          return null;
        }

        async function findCommentInput() {
          console.log('[COMMENT] Searching for comment input...');

          // Wait a bit for it to appear
          await new Promise(r => setTimeout(r, 1000));

          // Method 1: By aria-label
          let input = document.querySelector('[aria-label*="Write a comment"], [aria-label*="write a comment"], [placeholder*="Write a comment"]');
          if (input) {
            console.log('[COMMENT] ✓ Found input via aria-label/placeholder');
            return input;
          }

          // Method 2: Contenteditable textbox that appeared recently
          const editableDivs = Array.from(document.querySelectorAll('div[contenteditable="true"][role="textbox"]'));
          console.log('[COMMENT] Found', editableDivs.length, 'contenteditable textboxes');

          // Get the last one (most recently added)
          if (editableDivs.length > 0) {
            const lastInput = editableDivs[editableDivs.length - 1];
            console.log('[COMMENT] ✓ Using newest contenteditable textbox');
            return lastInput;
          }

          // Method 3: Any focused contenteditable
          const focused = document.activeElement;
          if (focused && focused.getAttribute('contenteditable') === 'true') {
            console.log('[COMMENT] ✓ Using focused contenteditable');
            return focused;
          }

          // Method 4: Textarea
          input = document.querySelector('textarea[placeholder*="comment" i]');
          if (input) {
            console.log('[COMMENT] ✓ Found textarea');
            return input;
          }

          console.log('[COMMENT] ❌ Could not find comment input');
          return null;
        }

        async function typeInInput(input, text) {
          console.log('[COMMENT] Typing text into input...');

          // Focus
          input.focus();
          input.click();
          await new Promise(r => setTimeout(r, 500));

          const isContentEditable = input.getAttribute('contenteditable') === 'true';
          console.log('[COMMENT] Input type:', isContentEditable ? 'contenteditable' : 'textarea/input');

          if (isContentEditable) {
            // Clear first
            input.innerHTML = '';
            input.textContent = '';

            // Set text
            input.textContent = text;

            // Trigger events
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));

            // Try execCommand
            try {
              document.execCommand('insertText', false, text);
            } catch(e) {}

            // Create proper InputEvent
            const inputEvent = new InputEvent('input', {
              bubbles: true,
              cancelable: true,
              inputType: 'insertText',
              data: text
            });
            input.dispatchEvent(inputEvent);

          } else {
            input.value = text;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
          }

          await new Promise(r => setTimeout(r, 800));

          const finalText = input.textContent || input.value || '';
          console.log('[COMMENT] Text in input after typing:', finalText.substring(0, 50));

          return finalText.length > 0;
        }

        async function submitComment(input) {
          console.log('[COMMENT] Attempting to submit comment...');

          // Method 1: Press Enter
          console.log('[COMMENT] Trying Enter key...');
          input.focus();

          const enterEvent = new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true,
            composed: true
          });
          input.dispatchEvent(enterEvent);

          await new Promise(r => setTimeout(r, 1000));

          // Method 2: Find Post/Comment button
          console.log('[COMMENT] Looking for submit button...');

          // Look for buttons near the comment input
          const allButtons = Array.from(document.querySelectorAll('div[role="button"], button'));

          const submitButtons = allButtons.filter(btn => {
            const text = (btn.textContent || '').trim().toLowerCase();
            const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();

            return (text === 'post' ||
                    text === 'comment' ||
                    ariaLabel.includes('post comment') ||
                    ariaLabel.includes('submit'));
          });

          console.log('[COMMENT] Found', submitButtons.length, 'potential submit buttons');

          // Find visible and enabled one
          for (const btn of submitButtons) {
            const rect = btn.getBoundingClientRect();
            const isVisible = rect.width > 0 && rect.height > 0;
            const isDisabled = btn.getAttribute('aria-disabled') === 'true' || btn.hasAttribute('disabled');

            if (isVisible && !isDisabled) {
              console.log('[COMMENT] ✓ Clicking submit button');
              btn.click();
              return true;
            }
          }

          console.log('[COMMENT] Submit attempted (relied on Enter key)');
          return true;
        }

        async function commentOnNextPost() {
          if (commentedCount >= maxComments) {
            console.log('[COMMENT] ========== COMPLETED:', commentedCount, 'comments ==========');
            return;
          }

          console.log('[COMMENT] ---------- Attempt #' + (commentedCount + 1), '----------');

          await closeModals();
          await new Promise(r => setTimeout(r, 1000));

          // Find comment button
          const commentButton = await findCommentButton();

          if (!commentButton) {
            console.log('[COMMENT] ⚠ No comment button found, scrolling...');
            window.scrollBy({ top: 600, behavior: 'smooth' });
            await new Promise(r => setTimeout(r, 2500));
            if (commentedCount < maxComments) {
              setTimeout(() => commentOnNextPost(), 2000);
            }
            return;
          }

          console.log('[COMMENT] ✓ Found comment button');
          commentButton.classList.add('commented');

          // Scroll into view
          commentButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
          await new Promise(r => setTimeout(r, 1000));

          // Click it
          console.log('[COMMENT] Clicking comment button...');
          commentButton.click();
          await new Promise(r => setTimeout(r, 2500)); // Wait longer for comment box

          // Find input
          const commentInput = await findCommentInput();

          if (!commentInput) {
            console.log('[COMMENT] ❌ No input found after clicking, moving to next post');
            await closeModals();
            window.scrollBy({ top: 400, behavior: 'smooth' });
            await new Promise(r => setTimeout(r, 2000));
            setTimeout(() => commentOnNextPost(), 2000);
            return;
          }

          console.log('[COMMENT] ✓ Found comment input');

          // Type comment
          const typed = await typeInInput(commentInput, commentText);

          if (!typed) {
            console.log('[COMMENT] ❌ Failed to type text, moving to next post');
            await closeModals();
            window.scrollBy({ top: 400, behavior: 'smooth' });
            await new Promise(r => setTimeout(r, 2000));
            setTimeout(() => commentOnNextPost(), 2000);
            return;
          }

          console.log('[COMMENT] ✓ Text typed successfully');
          await new Promise(r => setTimeout(r, 1000));

          // Submit
          await submitComment(commentInput);

          commentedCount++;
          console.log('[COMMENT] ✅ Comment #' + commentedCount + ' posted!');

          await new Promise(r => setTimeout(r, 2500));
          await closeModals();

          // Scroll and continue
          window.scrollBy({ top: 400, behavior: 'smooth' });
          await new Promise(r => setTimeout(r, 2500));

          setTimeout(() => commentOnNextPost(), 3000);
        }

        // Start
        commentOnNextPost();
        return { success: true, message: 'Started commenting...' };
      })();
      `,
        true
      )

      return result
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }
)

// Comment on all accounts
ipcMain.handle(
  'comment-on-posts-all',
  async (event, { comment, count = 3 }: { comment: string; count?: number }) => {
    const results = []
    for (const [accountId, view] of accountBrowserViews.entries()) {
      try {
        const accounts = await loadAccounts()
        const account = accounts.find((acc) => acc.id === accountId)

        await view.webContents.executeJavaScript(
          `
        (async () => {
          let commentedCount = 0;
          const maxComments = ${count};
          const commentText = \`${comment.replace(/`/g, '\\`').replace(/'/g, "\\'")}\`;

          async function closeModals() {
            const closeButtons = document.querySelectorAll('[aria-label*="Close"], [aria-label*="close"]');
            closeButtons.forEach(btn => { try { btn.click(); } catch(e) {} });
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
          }

          async function commentOnNextPost() {
            if (commentedCount >= maxComments) return;

            await closeModals();
            await new Promise(r => setTimeout(r, 500));

            const commentButtons = Array.from(document.querySelectorAll('[aria-label*="Comment"], [aria-label*="comment"]')).filter(btn => {
              return btn.getAttribute('role') === 'button' && !btn.classList.contains('commented');
            });

            if (commentButtons.length > 0) {
              const button = commentButtons[0];
              button.classList.add('commented');
              button.scrollIntoView({ behavior: 'smooth', block: 'center' });
              await new Promise(r => setTimeout(r, 800));

              button.click();
              await new Promise(r => setTimeout(r, 1500));

              let commentInput = document.querySelector('[aria-label*="Write a comment"]');
              if (!commentInput) commentInput = document.querySelector('div[contenteditable="true"][role="textbox"]');
              if (!commentInput) commentInput = document.querySelector('textarea[placeholder*="comment" i]');

              if (commentInput) {
                commentInput.focus();
                await new Promise(r => setTimeout(r, 300));

                if (commentInput.getAttribute('contenteditable') === 'true') {
                  commentInput.textContent = commentText;
                  commentInput.dispatchEvent(new Event('input', { bubbles: true }));
                } else {
                  commentInput.value = commentText;
                  commentInput.dispatchEvent(new Event('input', { bubbles: true }));
                }

                await new Promise(r => setTimeout(r, 800));

                const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true });
                commentInput.dispatchEvent(enterEvent);

                commentedCount++;
                await new Promise(r => setTimeout(r, 1500));
                await closeModals();

                window.scrollBy(0, 400);
                await new Promise(r => setTimeout(r, 2000));
                setTimeout(() => commentOnNextPost(), 2500);
              } else {
                window.scrollBy(0, 400);
                await new Promise(r => setTimeout(r, 1500));
                setTimeout(() => commentOnNextPost(), 2000);
              }
            } else {
              window.scrollBy(0, 600);
              await new Promise(r => setTimeout(r, 2000));
              if (commentedCount < maxComments) {
                setTimeout(() => commentOnNextPost(), 2000);
              }
            }
          }

          commentOnNextPost();
          return { success: true };
        })();
        `,
          true
        )

        results.push({ accountId, accountName: account?.name, success: true })
      } catch (err: any) {
        results.push({ accountId, success: false, error: err.message })
      }
    }

    return { success: true, results }
  }
)

// ====================== SHARE ACTIONS ======================

// Share posts on single account
ipcMain.handle(
  'share-posts-account',
  async (
    event,
    {
      accountId,
      count = 3,
      shareType = 'share_now'
    }: { accountId: string; count?: number; shareType?: string }
  ) => {
    try {
      const view = accountBrowserViews.get(accountId)
      if (!view) {
        return { success: false, error: 'Browser view not found' }
      }

      // shareType: 'share_now', 'share_to_story', 'share_to_group', 'send_in_messenger'
      const result = await view.webContents.executeJavaScript(
        `
      (async () => {
        let sharedCount = 0;
        const maxShares = ${count};
        const shareType = '${shareType}';

        console.log('[SHARE] Starting to share posts, target:', maxShares);

        async function closeModals() {
          const closeButtons = document.querySelectorAll('[aria-label*="Close"], [aria-label*="close"]');
          closeButtons.forEach(btn => { try { btn.click(); } catch(e) {} });
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
        }

        async function shareNextPost() {
          if (sharedCount >= maxShares) {
            console.log('[SHARE] Finished! Shared', sharedCount, 'posts');
            return;
          }

          await closeModals();
          await new Promise(r => setTimeout(r, 500));

          // Find share buttons
          const shareButtons = Array.from(document.querySelectorAll('[aria-label*="Share"], [aria-label*="share"]')).filter(btn => {
            return btn.getAttribute('role') === 'button' && !btn.classList.contains('shared');
          });

          console.log('[SHARE] Found', shareButtons.length, 'posts to share');

          if (shareButtons.length > 0) {
            const button = shareButtons[0];
            button.classList.add('shared');

            button.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await new Promise(r => setTimeout(r, 800));

            button.click();
            console.log('[SHARE] Clicked share button');
            await new Promise(r => setTimeout(r, 1500));

            // Find share option in menu
            let shareOption = null;

            if (shareType === 'share_now') {
              // Look for "Share now (Public)" or "Share now"
              shareOption = Array.from(document.querySelectorAll('[role="menuitem"], div[role="button"]')).find(item => {
                const text = item.textContent?.toLowerCase() || '';
                return text.includes('share now') || text.includes('share to feed');
              });
            } else if (shareType === 'share_to_story') {
              shareOption = Array.from(document.querySelectorAll('[role="menuitem"]')).find(item => {
                return item.textContent?.toLowerCase().includes('share to story');
              });
            } else if (shareType === 'share_to_group') {
              shareOption = Array.from(document.querySelectorAll('[role="menuitem"]')).find(item => {
                return item.textContent?.toLowerCase().includes('share to a group');
              });
            } else if (shareType === 'send_in_messenger') {
              shareOption = Array.from(document.querySelectorAll('[role="menuitem"]')).find(item => {
                return item.textContent?.toLowerCase().includes('send in messenger');
              });
            }

            if (shareOption) {
              shareOption.click();
              console.log('[SHARE] Clicked share option');
              await new Promise(r => setTimeout(r, 1500));

              // If it's "Share now", might need to confirm
              // Look for final "Share" or "Post" button
              const confirmButtons = Array.from(document.querySelectorAll('div[role="button"], button')).filter(btn => {
                const text = btn.textContent?.toLowerCase() || '';
                return text === 'share' || text === 'post';
              });

              if (confirmButtons.length > 0) {
                confirmButtons[0].click();
                console.log('[SHARE] Confirmed share');
              }

              sharedCount++;
              console.log('[SHARE] Shared post #' + sharedCount);

              await new Promise(r => setTimeout(r, 2000));
              await closeModals();

              window.scrollBy(0, 400);
              await new Promise(r => setTimeout(r, 2000));

              setTimeout(() => shareNextPost(), 2500);
            } else {
              console.log('[SHARE] Could not find share option, trying next post');
              await closeModals();
              window.scrollBy(0, 400);
              setTimeout(() => shareNextPost(), 2000);
            }
          } else {
            console.log('[SHARE] No more posts found, scrolling...');
            window.scrollBy(0, 600);
            await new Promise(r => setTimeout(r, 2000));
            if (sharedCount < maxShares) {
              setTimeout(() => shareNextPost(), 2000);
            }
          }
        }

        shareNextPost();
        return { success: true, message: 'Started sharing posts...' };
      })();
      `,
        true
      )

      return result
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }
)

// Share posts on all accounts
ipcMain.handle(
  'share-posts-all',
  async (
    event,
    { count = 3, shareType = 'share_now' }: { count?: number; shareType?: string } = {}
  ) => {
    const results = []

    for (const [accountId, view] of accountBrowserViews.entries()) {
      try {
        const accounts = await loadAccounts()
        const account = accounts.find((acc) => acc.id === accountId)

        await view.webContents.executeJavaScript(
          `
        (async () => {
          let sharedCount = 0;
          const maxShares = ${count};

          async function closeModals() {
            const closeButtons = document.querySelectorAll('[aria-label*="Close"]');
            closeButtons.forEach(btn => { try { btn.click(); } catch(e) {} });
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
          }

          async function shareNextPost() {
            if (sharedCount >= maxShares) return;

            await closeModals();
            await new Promise(r => setTimeout(r, 500));

            const shareButtons = Array.from(document.querySelectorAll('[aria-label*="Share"]')).filter(btn => {
              return btn.getAttribute('role') === 'button' && !btn.classList.contains('shared');
            });

            if (shareButtons.length > 0) {
              const button = shareButtons[0];
              button.classList.add('shared');
              button.scrollIntoView({ behavior: 'smooth', block: 'center' });
              await new Promise(r => setTimeout(r, 800));

              button.click();
              await new Promise(r => setTimeout(r, 1500));

              const shareOption = Array.from(document.querySelectorAll('[role="menuitem"]')).find(item => {
                const text = item.textContent?.toLowerCase() || '';
                return text.includes('share now') || text.includes('share to feed');
              });

              if (shareOption) {
                shareOption.click();
                await new Promise(r => setTimeout(r, 1500));

                const confirmButtons = Array.from(document.querySelectorAll('div[role="button"]')).filter(btn => {
                  return btn.textContent?.toLowerCase() === 'share';
                });

                if (confirmButtons.length > 0) {
                  confirmButtons[0].click();
                }

                sharedCount++;
                await new Promise(r => setTimeout(r, 2000));
                await closeModals();

                window.scrollBy(0, 400);
                await new Promise(r => setTimeout(r, 2000));
                setTimeout(() => shareNextPost(), 2500);
              } else {
                await closeModals();
                window.scrollBy(0, 400);
                setTimeout(() => shareNextPost(), 2000);
              }
            } else {
              window.scrollBy(0, 600);
              await new Promise(r => setTimeout(r, 2000));
              if (sharedCount < maxShares) {
                setTimeout(() => shareNextPost(), 2000);
              }
            }
          }

          shareNextPost();
          return { success: true };
        })();
        `,
          true
        )

        results.push({ accountId, accountName: account?.name, success: true })
      } catch (err: any) {
        results.push({ accountId, success: false, error: err.message })
      }
    }

    return { success: true, results }
  }
)

// ====================== FOLLOW/FRIEND ACTIONS ======================

// Follow pages on single account
ipcMain.handle(
  'follow-pages-account',
  async (event, { accountId, count = 5 }: { accountId: string; count?: number }) => {
    try {
      const view = accountBrowserViews.get(accountId)
      if (!view) {
        return { success: false, error: 'Browser view not found' }
      }

      const result = await view.webContents.executeJavaScript(
        `
      (async () => {
        let followedCount = 0;
        const maxFollows = ${count};

        console.log('[FOLLOW] Starting to follow pages/people, target:', maxFollows);

        async function closeModals() {
          const closeButtons = document.querySelectorAll('[aria-label*="Close"]');
          closeButtons.forEach(btn => { try { btn.click(); } catch(e) {} });
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
        }

        async function followNext() {
          if (followedCount >= maxFollows) {
            console.log('[FOLLOW] Finished! Followed', followedCount, 'pages/people');
            return;
          }

          await closeModals();
          await new Promise(r => setTimeout(r, 500));

          // Find Follow buttons or Add Friend buttons
          const followButtons = Array.from(document.querySelectorAll('[aria-label*="Follow"], [aria-label*="Add Friend"]')).filter(btn => {
            const label = btn.getAttribute('aria-label') || '';
            const text = btn.textContent || '';
            return (label.includes('Follow') || label.includes('Add Friend') || text.includes('Follow')) &&
                   !btn.classList.contains('followed') &&
                   !label.includes('Following') && // Don't click already following
                   !label.includes('Friends'); // Don't click already friends
          });

          console.log('[FOLLOW] Found', followButtons.length, 'pages/people to follow');

          if (followButtons.length > 0) {
            const button = followButtons[0];
            button.classList.add('followed');

            button.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await new Promise(r => setTimeout(r, 800));

            button.click();
            console.log('[FOLLOW] Clicked follow/add friend button');
            followedCount++;

            await new Promise(r => setTimeout(r, 1500));
            await closeModals();

            window.scrollBy(0, 400);
            await new Promise(r => setTimeout(r, 2000));

            setTimeout(() => followNext(), 2000);
          } else {
            console.log('[FOLLOW] No more buttons found, scrolling...');
            window.scrollBy(0, 600);
            await new Promise(r => setTimeout(r, 2000));
            if (followedCount < maxFollows) {
              setTimeout(() => followNext(), 2000);
            }
          }
        }

        followNext();
        return { success: true, message: 'Started following pages/people...' };
      })();
      `,
        true
      )

      return result
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }
)

// Follow pages on all accounts
ipcMain.handle('follow-pages-all', async (event, { count = 5 }: { count?: number } = {}) => {
  const results = []

  for (const [accountId, view] of accountBrowserViews.entries()) {
    try {
      const accounts = await loadAccounts()
      const account = accounts.find((acc) => acc.id === accountId)

      await view.webContents.executeJavaScript(
        `
        (async () => {
          let followedCount = 0;
          const maxFollows = ${count};

          async function closeModals() {
            const closeButtons = document.querySelectorAll('[aria-label*="Close"]');
            closeButtons.forEach(btn => { try { btn.click(); } catch(e) {} });
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
          }

          async function followNext() {
            if (followedCount >= maxFollows) return;

            await closeModals();
            await new Promise(r => setTimeout(r, 500));

            const followButtons = Array.from(document.querySelectorAll('[aria-label*="Follow"], [aria-label*="Add Friend"]')).filter(btn => {
              const label = btn.getAttribute('aria-label') || '';
              return (label.includes('Follow') || label.includes('Add Friend')) &&
                     !btn.classList.contains('followed') &&
                     !label.includes('Following') &&
                     !label.includes('Friends');
            });

            if (followButtons.length > 0) {
              const button = followButtons[0];
              button.classList.add('followed');
              button.scrollIntoView({ behavior: 'smooth', block: 'center' });
              await new Promise(r => setTimeout(r, 800));

              button.click();
              followedCount++;

              await new Promise(r => setTimeout(r, 1500));
              await closeModals();

              window.scrollBy(0, 400);
              await new Promise(r => setTimeout(r, 2000));
              setTimeout(() => followNext(), 2000);
            } else {
              window.scrollBy(0, 600);
              await new Promise(r => setTimeout(r, 2000));
              if (followedCount < maxFollows) {
                setTimeout(() => followNext(), 2000);
              }
            }
          }

          followNext();
          return { success: true };
        })();
        `,
        true
      )

      results.push({ accountId, accountName: account?.name, success: true })
    } catch (err: any) {
      results.push({ accountId, success: false, error: err.message })
    }
  }

  return { success: true, results }
})

// Join groups
ipcMain.handle(
  'join-groups-account',
  async (event, { accountId, count = 3 }: { accountId: string; count?: number }) => {
    try {
      const view = accountBrowserViews.get(accountId)
      if (!view) {
        return { success: false, error: 'Browser view not found' }
      }

      const result = await view.webContents.executeJavaScript(
        `
      (async () => {
        let joinedCount = 0;
        const maxJoins = ${count};

        console.log('[JOIN] Starting to join groups, target:', maxJoins);

        async function closeModals() {
          const closeButtons = document.querySelectorAll('[aria-label*="Close"]');
          closeButtons.forEach(btn => { try { btn.click(); } catch(e) {} });
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
        }

        async function joinNext() {
          if (joinedCount >= maxJoins) {
            console.log('[JOIN] Finished! Joined', joinedCount, 'groups');
            return;
          }

          await closeModals();
          await new Promise(r => setTimeout(r, 500));

          // Find "Join Group" or "Join" buttons
          const joinButtons = Array.from(document.querySelectorAll('[aria-label*="Join"], div[role="button"]')).filter(btn => {
            const label = btn.getAttribute('aria-label') || '';
            const text = btn.textContent || '';
            return (label.includes('Join') || text.trim() === 'Join') &&
                   !btn.classList.contains('joined') &&
                   !label.includes('Joined');
          });

          console.log('[JOIN] Found', joinButtons.length, 'groups to join');

          if (joinButtons.length > 0) {
            const button = joinButtons[0];
            button.classList.add('joined');

            button.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await new Promise(r => setTimeout(r, 800));

            button.click();
            console.log('[JOIN] Clicked join button');
            joinedCount++;

            await new Promise(r => setTimeout(r, 1500));
            await closeModals();

            window.scrollBy(0, 400);
            await new Promise(r => setTimeout(r, 2000));

            setTimeout(() => joinNext(), 2000);
          } else {
            console.log('[JOIN] No more groups found, scrolling...');
            window.scrollBy(0, 600);
            await new Promise(r => setTimeout(r, 2000));
            if (joinedCount < maxJoins) {
              setTimeout(() => joinNext(), 2000);
            }
          }
        }

        joinNext();
        return { success: true, message: 'Started joining groups...' };
      })();
      `,
        true
      )

      return result
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }
)
