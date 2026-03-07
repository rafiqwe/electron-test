export interface Account {
  id: string
  username: string
  password: string
  name: string
  status: 'active' | 'inactive' | 'error' | 'logged-in'
  lastLogin?: string
  notes?: string
  proxy?: string
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface BrowserAction {
  type: 'navigate' | 'click' | 'scroll' | 'type' | 'wait' | 'executeScript'
  selector?: string
  value?: string
  script?: string
  url?: string
  delay?: number
}

export interface ElectronAPI {
  // Account Management
  getAccounts: () => Promise<{ success: boolean; accounts: Account[] }>
  addAccount: (
    account: Omit<Account, 'id' | 'status'>
  ) => Promise<{ success: boolean; account: Account }>
  updateAccount: (data: {
    id: string
    updates: Partial<Account>
  }) => Promise<{ success: boolean; account: Account }>
  deleteAccount: (id: string) => Promise<{ success: boolean; error?: string }>

  // Window Management
  openAccountWindow: (id: string) => Promise<{ success: boolean; message?: string; error?: string }>
  closeAccountWindow: (id: string) => Promise<{ success: boolean; error?: string }>
  closeAllBrowsers: () => Promise<{ success: boolean; message?: string; error?: string }>
  saveAccountSession: (
    id: string
  ) => Promise<{ success: boolean; message?: string; error?: string }>

  // Auto-Login
  autoLoginAccount: (id: string) => Promise<{ success: boolean; message?: string; error?: string }>

  // Bulk Operations
  bulkOpenAccounts: (ids: string[]) => Promise<{ success: boolean; results: any[] }>
  bulkLoginAccounts: (ids: string[]) => Promise<{ success: boolean; results: any[] }>

  // Browser Actions
  executeActionOnAccount: (
    accountId: string,
    action: BrowserAction
  ) => Promise<{ success: boolean; result?: any; error?: string }>
  executeActionOnAllAccounts: (
    action: BrowserAction
  ) => Promise<{ success: boolean; results: any[] }>
  navigateAccountTo: (
    accountId: string,
    url: string
  ) => Promise<{ success: boolean; error?: string }>
  navigateAllAccountsTo: (url: string) => Promise<{ success: boolean; results: any[] }>
  getActiveBrowsers: () => Promise<{ success: boolean; accountIds: string[] }>

  // Utilities
  getWindowStatus: () => Promise<{
    success: boolean
    windows: Array<{ accountId: string; isOpen: boolean; url: string | null }>
  }>
  exportAccounts: () => Promise<{ success: boolean; data?: string; error?: string }>
  importAccounts: (
    jsonData: string
  ) => Promise<{ success: boolean; imported?: number; error?: string }>

  updateScrollPosition: (scrollY: number) => Promise<{ success: boolean }>
  getGridHeight: () => Promise<{ success: boolean; height?: number; rows?: number; cols?: number }>

  // Enhanced actions
  scrollAccount: (
    accountId: string,
    duration?: number
  ) => Promise<{ success: boolean; error?: string }>
  scrollAllAccounts: (duration?: number) => Promise<{ success: boolean; results: any[] }>
  watchReelsAccount: (
    accountId: string,
    duration?: number
  ) => Promise<{ success: boolean; message?: string; error?: string }>
  watchReelsAllAccounts: (duration?: number) => Promise<{ success: boolean; results: any[] }>
  likePostsAccount: (
    accountId: string,
    count?: number
  ) => Promise<{ success: boolean; message?: string; error?: string }>
  likePostsAllAccounts: (count?: number) => Promise<{ success: boolean; results: any[] }>
  // commentOnPosts: (
  //   accountId: string,
  //   comment: string,
  //   count?: number
  // ) => Promise<{ success: boolean; message?: string; error?: string }>
  // sharePostsAccount: (
  //   accountId: string,
  //   count?: number
  // ) => Promise<{ success: boolean; message?: string; error?: string }>
  followPeopleAccount: (
    accountId: string,
    count?: number
  ) => Promise<{ success: boolean; message?: string; error?: string }>
  reactToStories: (
    accountId: string,
    count?: number
  ) => Promise<{ success: boolean; message?: string; error?: string }>
  watchVideosAccount: (
    accountId: string,
    duration?: number
  ) => Promise<{ success: boolean; error?: string }>
  stopAllActionsAccount: (accountId: string) => Promise<{ success: boolean; error?: string }>
  stopAllActions: () => Promise<{ success: boolean; results: any[] }>

  commentOnPosts: (
    accountId: string,
    comment: string,
    count?: number
  ) => Promise<{ success: boolean; message?: string; error?: string }>
  commentOnPostsAll: (
    comment: string,
    count?: number
  ) => Promise<{ success: boolean; results: any[] }>

  // Share actions
  sharePostsAccount: (
    accountId: string,
    count?: number,
    shareType?: string
  ) => Promise<{ success: boolean; message?: string; error?: string }>
  sharePostsAll: (
    count?: number,
    shareType?: string
  ) => Promise<{ success: boolean; results: any[] }>

  // Follow/Friend actions
  followPagesAccount: (
    accountId: string,
    count?: number
  ) => Promise<{ success: boolean; message?: string; error?: string }>
  followPagesAll: (count?: number) => Promise<{ success: boolean; results: any[] }>
  joinGroupsAccount: (
    accountId: string,
    count?: number
  ) => Promise<{ success: boolean; message?: string; error?: string }>

  // Legacy
  ping: () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
  }
}
