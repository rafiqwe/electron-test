import React from 'react'
import type { Account } from '../../../types'

interface StatsCardsProps {
  accounts: Account[]
}

const StatsCards: React.FC<StatsCardsProps> = ({ accounts }) => {
  const stats = {
    total: accounts.length,
    loggedIn: accounts.filter((a) => a.status === 'logged-in').length,
    active: accounts.filter((a) => a.status === 'active').length,
    errors: accounts.filter((a) => a.status === 'error').length
  }

  return (
    <div className="grid grid-cols-4 gap-4 mt-10 pt-6 pb-5">
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
        <div className="text-slate-400 text-sm">Total Accounts</div>
        <div className="text-3xl font-bold mt-1">{stats.total}</div>
      </div>
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
        <div className="text-slate-400 text-sm">Logged In</div>
        <div className="text-3xl font-bold mt-1 text-green-400">{stats.loggedIn}</div>
      </div>
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
        <div className="text-slate-400 text-sm">Active</div>
        <div className="text-3xl font-bold mt-1 text-blue-400">{stats.active}</div>
      </div>
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
        <div className="text-slate-400 text-sm">Errors</div>
        <div className="text-3xl font-bold mt-1 text-red-400">{stats.errors}</div>
      </div>
    </div>
  )
}

export default StatsCards
