import React, { useState } from 'react'
import type { Account } from '../../../types'

interface AccountModalProps {
  account: Account | null
  onClose: () => void
  onSave: (data: Omit<Account, 'id' | 'status'>) => void
}

const AccountModal: React.FC<AccountModalProps> = ({ account, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: account?.name || '',
    username: account?.username || '',
    password: account?.password || '',
    notes: account?.notes || '',
    proxy: account?.proxy || ''
  })

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    onSave(formData)
  }

  const handleChange =
    (field: keyof typeof formData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
      setFormData({ ...formData, [field]: e.target.value })
    }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg p-6 w-full max-w-md border border-slate-700">
        <h2 className="text-2xl font-bold mb-4">{account ? 'Edit Account' : 'Add New Account'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Account Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={handleChange('name')}
              className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 focus:outline-none focus:border-blue-500 text-white"
              placeholder="e.g., Main Account"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Username/Email <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.username}
              onChange={handleChange('username')}
              className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 focus:outline-none focus:border-blue-500 text-white"
              placeholder="email@example.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Password <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={handleChange('password')}
              className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 focus:outline-none focus:border-blue-500 text-white"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Notes (Optional)</label>
            <textarea
              value={formData.notes}
              onChange={handleChange('notes')}
              className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 focus:outline-none focus:border-blue-500 text-white h-20 resize-none"
              placeholder="Any additional notes..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Proxy (Optional)</label>
            <input
              type="text"
              value={formData.proxy}
              onChange={handleChange('proxy')}
              className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 focus:outline-none focus:border-blue-500 text-white"
              placeholder="http://proxy:port"
            />
          </div>
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors font-medium"
            >
              {account ? 'Update' : 'Add'} Account
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-600 hover:bg-slate-700 px-4 py-2 rounded-lg transition-colors font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AccountModal
