import React, { useState, useEffect } from 'react'
import { Users, Plus, RefreshCw, Download, Upload, Loader2, MonitorPlay } from 'lucide-react'
import type { Account } from '../../../types/index'
import AccountModal from './AccountModal'
import AccountTable from './AccountTable'
import StatsCards from './StatsCards'

interface AccountManagerProps {
  onNavigateToBrowsers: (accountIds: string[]) => void
}

const AccountManager: React.FC<AccountManagerProps> = ({ onNavigateToBrowsers }) => {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set())
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [isBulkLoading, setIsBulkLoading] = useState(false)

  useEffect(() => {
    loadAccounts()
  }, [])

  const loadAccounts = async (): Promise<void> => {
    setIsLoading(true)
    try {
      const result = await window.electron.getAccounts()
      if (result.success) {
        setAccounts(result.accounts)
      }
    } catch (error) {
      console.error('Failed to load accounts:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddAccount = async (accountData: Omit<Account, 'id' | 'status'>): Promise<void> => {
    try {
      const result = await window.electron.addAccount(accountData)
      if (result.success) {
        setAccounts([...accounts, result.account])
        setShowAddModal(false)
      }
    } catch (error: any) {
      alert('Failed to add account: ' + error.message)
    }
  }

  const handleUpdateAccount = async (id: string, updates: Partial<Account>): Promise<void> => {
    try {
      const result = await window.electron.updateAccount({ id, updates })
      if (result.success) {
        setAccounts(accounts.map((acc) => (acc.id === id ? result.account : acc)))
        setEditingAccount(null)
      }
    } catch (error: any) {
      alert('Failed to update account: ' + error.message)
    }
  }

  const handleDeleteAccount = async (id: string): Promise<void> => {
    if (!confirm('Are you sure you want to delete this account?')) return

    try {
      const result = await window.electron.deleteAccount(id)
      if (result.success) {
        setAccounts(accounts.filter((acc) => acc.id !== id))
        const newSelected = new Set(selectedAccounts)
        newSelected.delete(id)
        setSelectedAccounts(newSelected)
      }
    } catch (error: any) {
      alert('Failed to delete account: ' + error.message)
    }
  }

  const handleOpenWindow = async (accountId: string): Promise<void> => {
    try {
      setIsBulkLoading(true)
      await window.electron.openAccountWindow(accountId)
      // Navigate to browser dashboard with single account
      onNavigateToBrowsers([accountId])
    } catch (error: any) {
      alert('Failed to open window: ' + error.message)
    } finally {
      setIsBulkLoading(false)
    }
  }

  const handleAutoLogin = async (accountId: string): Promise<void> => {
    try {
      setIsBulkLoading(true)
      const result = await window.electron.autoLoginAccount(accountId)
      if (result.success) {
        await loadAccounts()
        // Navigate to browser dashboard
        onNavigateToBrowsers([accountId])
      } else {
        alert('Login failed: ' + (result.error || 'Unknown error'))
      }
    } catch (error: any) {
      alert('Failed to auto-login: ' + error.message)
    } finally {
      setIsBulkLoading(false)
    }
  }

  const handleBulkOpen = async (): Promise<void> => {
    const ids = Array.from(selectedAccounts)
    if (ids.length === 0) {
      alert('Please select accounts first')
      return
    }

    setIsBulkLoading(true)
    try {
      await window.electron.bulkOpenAccounts(ids)
      // Navigate to browser dashboard with selected accounts
      onNavigateToBrowsers(ids)
    } catch (error: any) {
      alert('Failed to bulk open: ' + error.message)
    } finally {
      setIsBulkLoading(false)
    }
  }

  const handleBulkLogin = async (): Promise<void> => {
    const ids = Array.from(selectedAccounts)
    if (ids.length === 0) {
      alert('Please select accounts first')
      return
    }

    if (
      !confirm(
        `Login to ${ids.length} accounts? This will take approximately ${Math.ceil((ids.length * 10) / 60)} minutes.`
      )
    )
      return

    setIsBulkLoading(true)
    try {
      await window.electron.bulkLoginAccounts(ids)
      await loadAccounts()
      // Navigate to browser dashboard with logged in accounts
      onNavigateToBrowsers(ids)
    } catch (error: any) {
      alert('Failed to bulk login: ' + error.message)
    } finally {
      setIsBulkLoading(false)
    }
  }

  const handleExport = async (): Promise<void> => {
    try {
      const result = await window.electron.exportAccounts()
      if (result.success && result.data) {
        const blob = new Blob([result.data], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `fb-accounts-${Date.now()}.json`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (error: any) {
      alert('Failed to export: ' + error.message)
    }
  }

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const result = await window.electron.importAccounts(text)
      if (result.success) {
        alert(`Imported ${result.imported} accounts`)
        await loadAccounts()
      } else {
        alert('Import failed: ' + (result.error || 'Unknown error'))
      }
    } catch (error: any) {
      alert('Failed to import: ' + error.message)
    }
    event.target.value = ''
  }

  const toggleSelectAccount = (id: string): void => {
    const newSelected = new Set(selectedAccounts)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedAccounts(newSelected)
  }

  const toggleSelectAll = (): void => {
    if (selectedAccounts.size === accounts.length) {
      setSelectedAccounts(new Set())
    } else {
      setSelectedAccounts(new Set(accounts.map((acc) => acc.id)))
    }
  }

  const togglePasswordVisibility = (id: string): void => {
    setShowPasswords((prev) => ({
      ...prev,
      [id]: !prev[id]
    }))
  }

  return (
    <div className="min-h-screen bg-linear-to-br custom-scrollbar from-slate-900 via-blue-900 to-slate-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Users className="w-10 h-10 text-blue-400" />
            <div>
              <h1 className="text-3xl font-bold">Facebook Account Manager</h1>
              <p className="text-slate-400">Manage multiple accounts efficiently</p>
            </div>
          </div>
          <div className="flex gap-3">
            <label className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg cursor-pointer transition-colors">
              <Upload className="w-5 h-5" />
              Import
              <input type="file" accept=".json" onChange={handleImport} className="hidden" />
            </label>
            <button
              onClick={handleExport}
              disabled={accounts.length === 0}
              className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:cursor-not-allowed px-4 py-2 rounded-lg transition-colors"
            >
              <Download className="w-5 h-5" />
              Export
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add Account
            </button>
          </div>
        </div>

        {/* Loading Overlay */}
        {isBulkLoading && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-slate-800 rounded-lg p-8 flex flex-col items-center gap-4">
              <Loader2 className="w-12 h-12 animate-spin text-blue-400" />
              <p className="text-lg">Opening browser dashboard...</p>
            </div>
          </div>
        )}

        {/* Bulk Actions */}
        {selectedAccounts.size > 0 && (
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 mb-6 flex items-center justify-between">
            <span className="text-lg">
              {selectedAccounts.size} account{selectedAccounts.size > 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-3">
              <button
                onClick={handleBulkOpen}
                disabled={isBulkLoading}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-4 py-2 rounded-lg transition-colors"
              >
                <MonitorPlay className="w-4 h-4" />
                Open Dashboard
              </button>
              <button
                onClick={handleBulkLogin}
                disabled={isBulkLoading}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-4 py-2 rounded-lg transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Login & Open Dashboard
              </button>
              <button
                onClick={() => setSelectedAccounts(new Set())}
                className="flex items-center gap-2 bg-slate-600 hover:bg-slate-700 px-4 py-2 rounded-lg transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        <StatsCards accounts={accounts} />

        {/* Account Table */}
        <AccountTable
          accounts={accounts}
          selectedAccounts={selectedAccounts}
          showPasswords={showPasswords}
          isLoading={isLoading}
          onToggleSelect={toggleSelectAccount}
          onToggleSelectAll={toggleSelectAll}
          onTogglePassword={togglePasswordVisibility}
          onOpenWindow={handleOpenWindow}
          onAutoLogin={handleAutoLogin}
          onEdit={setEditingAccount}
          onDelete={handleDeleteAccount}
        />

        {/* Stats */}
      </div>

      {/* Add/Edit Modal */}
      {(showAddModal || editingAccount) && (
        <AccountModal
          account={editingAccount}
          onClose={() => {
            setShowAddModal(false)
            setEditingAccount(null)
          }}
          onSave={(data) => {
            if (editingAccount) {
              handleUpdateAccount(editingAccount.id, data)
            } else {
              handleAddAccount(data)
            }
          }}
        />
      )}
    </div>
  )
}

export default AccountManager
