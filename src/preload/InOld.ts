import { contextBridge, ipcRenderer } from 'electron'
import { ElectronAPI } from '../types'
const electronAPI: ElectronAPI = {
  // Account Management
  getAccounts: () => ipcRenderer.invoke('get-accounts'),
  addAccount: (account) => ipcRenderer.invoke('add-account', account),
  updateAccount: (data) => ipcRenderer.invoke('update-account', data),
  deleteAccount: (id) => ipcRenderer.invoke('delete-account', id),

  // Window Management
  openAccountWindow: (id) => ipcRenderer.invoke('open-account-window', id),
  closeAccountWindow: (id) => ipcRenderer.invoke('close-account-window', id),
  saveAccountSession: (id) => ipcRenderer.invoke('save-account-session', id),

  // Auto-Login
  autoLoginAccount: (id) => ipcRenderer.invoke('auto-login-account', id),

  // Bulk Operations
  bulkOpenAccounts: (ids) => ipcRenderer.invoke('bulk-open-accounts', ids),
  bulkLoginAccounts: (ids) => ipcRenderer.invoke('bulk-login-accounts', ids),

  // Utilities
  getWindowStatus: () => ipcRenderer.invoke('get-window-status'),
  exportAccounts: () => ipcRenderer.invoke('export-accounts'),
  importAccounts: (jsonData) => ipcRenderer.invoke('import-accounts', jsonData),

  // Legacy
  ping: () => ipcRenderer.send('ping')
}

contextBridge.exposeInMainWorld('electron', electronAPI)
