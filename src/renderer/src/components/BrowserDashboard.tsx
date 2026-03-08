import React, { useState, useEffect, useRef } from 'react'
import { ArrowLeft, Users, Loader2, Maximize2 } from 'lucide-react'
import type { Account } from '../../../types/index'
import RightSideBar from './browserDash/RightSideBar'

interface BrowserDashboardProps {
  accountIds: string[]
  onBack: () => void
}

const BrowserDashboard: React.FC<BrowserDashboardProps> = ({ accountIds, onBack }) => {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [actionStatus, setActionStatus] = useState<string>('')
  const [expandedSection, setExpandedSection] = useState<string>('navigation')
  const [gridHeight, setGridHeight] = useState(0)
  const [gridInfo, setGridInfo] = useState({ rows: 0, cols: 0 })
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const loadAccountDetails = async (): Promise<void> => {
    try {
      const result = await window.electron.getAccounts()
      if (result.success) {
        const filteredAccounts = result.accounts.filter((acc) => accountIds.includes(acc.id))
        setAccounts(filteredAccounts)
      }
    } catch (error) {
      console.error('Failed to load account details:', error)
    }
  }

  const loadGridHeight = async (): Promise<void> => {
    try {
      const result = await window.electron.getGridHeight()
      if (result.success && result.height) {
        setGridHeight(result.height)
        setGridInfo({ rows: result.rows || 0, cols: result.cols || 0 })
      }
    } catch (error) {
      console.error('Failed to load grid height:', error)
    }
  }

  useEffect(() => {
    loadAccountDetails()
    loadGridHeight()
  }, [accountIds])

  // Handle scroll events
  const handleScroll = (e: React.UIEvent<HTMLDivElement>): void => {
    const scrollY = e.currentTarget.scrollTop
    window.electron.updateScrollPosition(scrollY)
  }

  const handleCloseAll = async (): Promise<void> => {
    if (!confirm('Close all browsers and return to account management?')) return

    try {
      await window.electron.closeAllBrowsers()
      onBack()
    } catch (error: any) {
      alert('Failed to close browsers: ' + error.message)
    }
  }

  return (
    <div className="h-screen flex flex-col bg-slate-900 text-white overflow-hidden">
      {/* Top Header - Fixed */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-3 shrink-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={handleCloseAll}
              className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-lg transition-colors text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <div>
              <h1 className="text-lg font-bold">Browser Control Dashboard</h1>
              <p className="text-slate-400 text-xs">
                {accounts.length} accounts • {gridInfo.cols} columns × {gridInfo.rows} rows
              </p>
            </div>
          </div>

          {actionStatus && (
            <div className="flex items-center gap-2 bg-blue-600 px-3 py-2 rounded-lg text-sm">
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{actionStatus}</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area - Flex Row */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Side - Scrollable Container */}
        <div
          ref={scrollContainerRef}
          className="flex-1 bg-slate-900 overflow-y-auto custom-scrollbar"
          onScroll={handleScroll}
          style={{ height: 'calc(100vh - 49px)' }}
        >
          {/* Spacer div to create scrollable area matching grid height */}
          <div style={{ height: `${gridHeight}px`, minHeight: '100%', position: 'relative' }}>
            <div className="p-4">
              {/* Browser Grid Info */}
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-400" />
                    <h2 className="text-lg font-bold">Active Browser Grid</h2>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Maximize2 className="w-3 h-3" />
                    <span>
                      {gridInfo.cols}×{gridInfo.rows} Grid
                    </span>
                  </div>
                </div>

                <p className="text-sm text-slate-400 mb-4">
                  Scroll down to see all {accounts.length} browser{accounts.length > 1 ? 's' : ''}{' '}
                  in the grid below
                </p>

                {/* Account Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {accounts.map((account, idx) => (
                    <div
                      key={account.id}
                      className="bg-slate-700 rounded-lg p-3 border border-slate-600 hover:border-blue-500 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-mono text-slate-500">#{idx + 1}</span>
                        <div className="flex items-center gap-1">
                          <div
                            className={`w-2 h-2 rounded-full ${
                              account.status === 'logged-in'
                                ? 'bg-green-500 animate-pulse'
                                : account.status === 'active'
                                  ? 'bg-blue-500'
                                  : account.status === 'error'
                                    ? 'bg-red-500'
                                    : 'bg-gray-500'
                            }`}
                          ></div>
                          <span className="text-xs text-slate-400">
                            {account.status === 'logged-in'
                              ? 'Online'
                              : account.status === 'active'
                                ? 'Active'
                                : account.status === 'error'
                                  ? 'Error'
                                  : 'Idle'}
                          </span>
                        </div>
                      </div>
                      <h3 className="font-medium text-sm truncate mb-1">{account.name}</h3>
                      <p className="text-xs text-slate-400 truncate">{account.username}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Instructions */}
              <div className="bg-linear-to-r from-blue-900 to-purple-900 bg-opacity-30 border border-blue-700 rounded-lg p-4 mb-4">
                <h3 className="font-bold text-sm mb-2 flex items-center gap-2">
                  <span>📌</span> How to Use
                </h3>
                <ul className="text-xs text-blue-200 space-y-1.5">
                  <li>
                    • <strong>Scroll down this panel</strong> to scroll through all browser views
                    below
                  </li>
                  <li>
                    • All {accounts.length} browser{accounts.length > 1 ? 's are' : ' is'} displayed
                    in a {gridInfo.cols}×{gridInfo.rows} grid
                  </li>
                  <li>• The browser grid moves as you scroll - try it!</li>
                  <li>• Use the control panel on the right to perform synchronized actions</li>
                  <li>• All actions execute simultaneously across all accounts</li>
                </ul>
              </div>

              {/* Scroll Indicator */}
              <div className="bg-yellow-900 bg-opacity-30 border border-yellow-700 rounded-lg p-4 mb-4">
                <h3 className="font-bold text-sm mb-2 text-yellow-400">👇 Scroll Down</h3>
                <p className="text-xs text-yellow-200">
                  The browser grid extends below. Scroll this panel to see all {accounts.length}{' '}
                  browsers!
                </p>
              </div>

              {/* Quick Tips */}
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 mb-4">
                <h3 className="font-bold text-sm mb-2 text-purple-400">💡 Pro Tips</h3>
                <ul className="text-xs text-slate-300 space-y-1.5">
                  <li>
                    • <strong>Watch Reels:</strong> Automatically scrolls through reels for 1 minute
                  </li>
                  <li>
                    • <strong>Auto Scroll:</strong> Scrolls feed 20 times with 2-second intervals
                  </li>
                  <li>
                    • <strong>Custom Scripts:</strong> Write your own JavaScript to automate actions
                  </li>
                  <li>
                    • <strong>Grid Layout:</strong> Browsers auto-arrange based on window size
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Fixed Control Panel */}
        <RightSideBar
          // disabled={disabled}
          accounts={accounts}
          gridInfo={gridInfo}
          // onExecute={onExecute}
          onBack={onBack}
          setExpandedSection={setExpandedSection}
          expandedSection={expandedSection}
          isLoading={isLoading}
          setIsLoading={setIsLoading}
          setActionStatus={setActionStatus}
        />
      </div>
    </div>
  )
}

export default BrowserDashboard
