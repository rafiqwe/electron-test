import React from 'react'
import { Play, RefreshCw, Edit, Trash2, Eye, EyeOff } from 'lucide-react'
import type { Account } from '../../../types'

interface AccountTableProps {
  accounts: Account[]
  selectedAccounts: Set<string>
  showPasswords: Record<string, boolean>
  isLoading: boolean
  onToggleSelect: (id: string) => void
  onToggleSelectAll: () => void
  onTogglePassword: (id: string) => void
  onOpenWindow: (id: string) => void
  onAutoLogin: (id: string) => void
  onEdit: (account: Account) => void
  onDelete: (id: string) => void
}

const AccountTable: React.FC<AccountTableProps> = ({
  accounts,
  selectedAccounts,
  showPasswords,
  isLoading,
  onToggleSelect,
  onToggleSelectAll,
  onTogglePassword,
  onOpenWindow,
  onAutoLogin,
  onEdit,
  onDelete
}) => {
  const getStatusColor = (status: Account['status']): string => {
    switch (status) {
      case 'logged-in':
        return 'bg-green-500'
      case 'active':
        return 'bg-blue-500'
      case 'error':
        return 'bg-red-500'
      default:
        return 'bg-gray-400'
    }
  }

  const getStatusText = (status: Account['status']): string => {
    switch (status) {
      case 'logged-in':
        return 'Logged In'
      case 'active':
        return 'Active'
      case 'error':
        return 'Error'
      default:
        return 'Inactive'
    }
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
      <table className="w-full">
        <thead className="bg-slate-700">
          <tr>
            <th className="p-4 text-left">
              <input
                type="checkbox"
                checked={selectedAccounts.size === accounts.length && accounts.length > 0}
                onChange={onToggleSelectAll}
                className="w-4 h-4 cursor-pointer accent-blue-600"
              />
            </th>
            <th className="p-4 text-left">Status</th>
            <th className="p-4 text-left">Name</th>
            <th className="p-4 text-left">Username</th>
            <th className="p-4 text-left">Password</th>
            <th className="p-4 text-left">Last Login</th>
            <th className="p-4 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan={7} className="p-8 text-center text-slate-400">
                Loading accounts...
              </td>
            </tr>
          ) : accounts.length === 0 ? (
            <tr>
              <td colSpan={7} className="p-8 text-center text-slate-400">
                No accounts yet. Click "Add Account" to get started.
              </td>
            </tr>
          ) : (
            accounts.map((account) => (
              <tr
                key={account.id}
                className="border-t border-slate-700 hover:bg-slate-750 transition-colors"
              >
                <td className="p-4">
                  <input
                    type="checkbox"
                    checked={selectedAccounts.has(account.id)}
                    onChange={() => onToggleSelect(account.id)}
                    className="w-4 h-4 cursor-pointer accent-blue-600"
                  />
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${getStatusColor(account.status)}`}></div>
                    <span className="text-sm">{getStatusText(account.status)}</span>
                  </div>
                </td>
                <td className="p-4 font-medium">{account.name}</td>
                <td className="p-4 text-slate-300">{account.username}</td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm">
                      {showPasswords[account.id] ? account.password : '••••••••'}
                    </span>
                    <button
                      onClick={() => onTogglePassword(account.id)}
                      className="text-slate-400 hover:text-white transition-colors"
                    >
                      {showPasswords[account.id] ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </td>
                <td className="p-4 text-sm text-slate-400">
                  {account.lastLogin ? new Date(account.lastLogin).toLocaleString() : 'Never'}
                </td>
                <td className="p-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => onOpenWindow(account.id)}
                      className="p-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                      title="Open Window"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onAutoLogin(account.id)}
                      className="p-2 bg-green-600 hover:bg-green-700 rounded transition-colors"
                      title="Auto Login"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onEdit(account)}
                      className="p-2 bg-yellow-600 hover:bg-yellow-700 rounded transition-colors"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDelete(account.id)}
                      className="p-2 bg-red-600 hover:bg-red-700 rounded transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

export default AccountTable
