import { contextBridge, ipcRenderer } from 'electron'
import type { ElectronAPI } from '../types'

const electronAPI: ElectronAPI = {
  // Account Management
  getAccounts: () => ipcRenderer.invoke('get-accounts'),
  addAccount: (account) => ipcRenderer.invoke('add-account', account),
  updateAccount: (data) => ipcRenderer.invoke('update-account', data),
  deleteAccount: (id) => ipcRenderer.invoke('delete-account', id),

  // Window Management
  openAccountWindow: (id) => ipcRenderer.invoke('open-account-window', id),
  closeAccountWindow: (id) => ipcRenderer.invoke('close-account-window', id),
  closeAllBrowsers: () => ipcRenderer.invoke('close-all-browsers'),
  saveAccountSession: (id) => ipcRenderer.invoke('save-account-session', id),

  // Auto-Login
  autoLoginAccount: (id) => ipcRenderer.invoke('auto-login-account', id),

  // Bulk Operations
  bulkOpenAccounts: (ids) => ipcRenderer.invoke('bulk-open-accounts', ids),
  bulkLoginAccounts: (ids) => ipcRenderer.invoke('bulk-login-accounts', ids),

  // Browser Actions
  executeActionOnAccount: (accountId, action) =>
    ipcRenderer.invoke('execute-action-on-account', { accountId, action }),
  executeActionOnAllAccounts: (action) =>
    ipcRenderer.invoke('execute-action-on-all-accounts', action),
  navigateAccountTo: (accountId, url) =>
    ipcRenderer.invoke('navigate-account-to', { accountId, url }),
  navigateAllAccountsTo: (url) => ipcRenderer.invoke('navigate-all-accounts-to', url),
  getActiveBrowsers: () => ipcRenderer.invoke('get-active-browsers'),

  // Utilities
  getWindowStatus: () => ipcRenderer.invoke('get-window-status'),
  exportAccounts: () => ipcRenderer.invoke('export-accounts'),
  importAccounts: (jsonData) => ipcRenderer.invoke('import-accounts', jsonData),

  updateScrollPosition: (scrollY: number) => ipcRenderer.invoke('update-scroll-position', scrollY),
  getGridHeight: () => ipcRenderer.invoke('get-grid-height'),

  // Legacy
  ping: () => ipcRenderer.send('ping')
}

contextBridge.exposeInMainWorld('electron', electronAPI)
