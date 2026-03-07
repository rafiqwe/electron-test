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

  // Enhanced action handlers
  scrollAccount: (accountId: string, duration?: number) =>
    ipcRenderer.invoke('scroll-account', { accountId, duration }),
  scrollAllAccounts: (duration?: number) => ipcRenderer.invoke('scroll-all-accounts', { duration }),
  watchReelsAccount: (accountId: string, duration?: number) =>
    ipcRenderer.invoke('watch-reels-account', { accountId, duration }),
  watchReelsAllAccounts: (duration?: number) =>
    ipcRenderer.invoke('watch-reels-all-accounts', { duration }),
  likePostsAccount: (accountId: string, count?: number) =>
    ipcRenderer.invoke('like-posts-account', { accountId, count }),
  likePostsAllAccounts: (count?: number) =>
    ipcRenderer.invoke('like-posts-all-accounts', { count }),
  // commentOnPosts: (accountId: string, comment: string, count?: number) =>
  //   ipcRenderer.invoke('comment-on-posts', { accountId, comment, count }),
  // sharePostsAccount: (accountId: string, count?: number) =>
  //   ipcRenderer.invoke('share-posts-account', { accountId, count }),
  followPeopleAccount: (accountId: string, count?: number) =>
    ipcRenderer.invoke('follow-people-account', { accountId, count }),
  reactToStories: (accountId: string, count?: number) =>
    ipcRenderer.invoke('react-to-stories', { accountId, count }),
  watchVideosAccount: (accountId: string, duration?: number) =>
    ipcRenderer.invoke('watch-videos-account', { accountId, duration }),
  stopAllActionsAccount: (accountId: string) =>
    ipcRenderer.invoke('stop-all-actions-account', accountId),
  stopAllActions: () => ipcRenderer.invoke('stop-all-actions'),

  // Comment actions
  commentOnPosts: (accountId: string, comment: string, count?: number) =>
    ipcRenderer.invoke('comment-on-posts', { accountId, comment, count }),
  commentOnPostsAll: (comment: string, count?: number) =>
    ipcRenderer.invoke('comment-on-posts-all', { comment, count }),

  // Share actions
  sharePostsAccount: (accountId: string, count?: number, shareType?: string) =>
    ipcRenderer.invoke('share-posts-account', { accountId, count, shareType }),
  sharePostsAll: (count?: number, shareType?: string) =>
    ipcRenderer.invoke('share-posts-all', { count, shareType }),

  // Follow/Friend actions
  followPagesAccount: (accountId: string, count?: number) =>
    ipcRenderer.invoke('follow-pages-account', { accountId, count }),
  followPagesAll: (count?: number) => ipcRenderer.invoke('follow-pages-all', { count }),
  joinGroupsAccount: (accountId: string, count?: number) =>
    ipcRenderer.invoke('join-groups-account', { accountId, count }),

  // Legacy
  ping: () => ipcRenderer.send('ping')
}

contextBridge.exposeInMainWorld('electron', electronAPI)
