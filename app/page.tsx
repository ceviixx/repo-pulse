'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { analyzeRepository, getHealthScoreInterpretation, type ReleaseStats, type AnalysisStatus } from '@/lib/metrics'

interface AnalysisResult {
  owner: string
  name: string
  fullName: string
  description: string | null
  stars: number
  forks: number
  openIssues: number
  medianIssueResponseTime: number | null
  openIssuesCount: number
  closedIssuesCount: number
  totalCommitsLast90Days: number
  topContributorRatio: number
  releases: ReleaseStats[]
  totalReleases: number
  releasesLast90Days: number
  totalDownloads: number
  averageDownloadsPerRelease: number
  latestRelease: ReleaseStats | null
  healthScore: number
  watchers: number
  lastCommitDate: string
  openPullRequests: number
  license: string | null
  languages: Record<string, number>
  starsPerMonth: number
  recentStarGrowth: number
  prMergeRate: number
  codeAdditions: number
  codeDeletions: number
  totalCodeChanges: number
}

export default function Home() {
  const router = useRouter()
  const [repository, setRepository] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [githubToken, setGithubToken] = useState('')
  const [showTokenInput, setShowTokenInput] = useState(false)
  const [statusMessages, setStatusMessages] = useState<AnalysisStatus[]>([])
  const [currentStatus, setCurrentStatus] = useState<AnalysisStatus | null>(null)

  // Load token and last result from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('github_token')
    if (savedToken) {
      setGithubToken(savedToken)
    }

    // Load last analysis result if available and not older than 1 hour
    const savedResult = localStorage.getItem('lastAnalysisResult')
    const savedTimestamp = localStorage.getItem('lastAnalysisTimestamp')
    if (savedResult && savedTimestamp) {
      const age = Date.now() - parseInt(savedTimestamp)
      const oneHour = 60 * 60 * 1000
      if (age < oneHour) {
        try {
          const parsed = JSON.parse(savedResult)
          setResult(parsed)
          setRepository(`${parsed.owner}/${parsed.name}`)
        } catch (e) {
          // Ignore invalid saved data
        }
      }
    }
  }, [])

  const handleSaveToken = () => {
    if (githubToken) {
      localStorage.setItem('github_token', githubToken)
      setShowTokenInput(false)
    }
  }

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!repository.match(/^[\w-]+\/[\w.-]+$/)) {
      setError('Invalid format. Use: owner/repo')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)
    setStatusMessages([])
    setCurrentStatus(null)
    setShowTokenInput(false) // Close token modal when analyzing

    try {
      const [owner, name] = repository.split('/')
      const metrics = await analyzeRepository(owner, name, (status) => {
        setCurrentStatus(status)
        setStatusMessages(prev => [...prev, status])
      })
      setResult(metrics)
      // Save results to localStorage for other pages
      localStorage.setItem('lastAnalysisResult', JSON.stringify(metrics))
      localStorage.setItem('lastAnalysisTimestamp', Date.now().toString())
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Analysis failed'
      // Clean up redundant error prefix
      setError(errorMessage.replace(/^Failed to fetch repository: /, ''))
    } finally {
      setLoading(false)
    }
  }

  const healthInfo = result
    ? getHealthScoreInterpretation(result.healthScore)
    : null

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-slate-900 dark:to-indigo-950">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgwLDAsMCwwLjAyKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-40"></div>
      
      <div className="relative container mx-auto px-4 py-8 max-w-7xl">
        {/* Hero Header */}
        <div className="text-center mb-16 pt-8">
          <div className="inline-flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h1 className="text-6xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
              RepoPulse
            </h1>
          </div>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-6 font-light">
            Analyze GitHub repositories with comprehensive metrics and insights
          </p>
        </div>

        {/* Combined Search & Token Input */}
        <div className="max-w-4xl mx-auto mb-12">
          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-6">
            <form onSubmit={handleAnalyze}>
              {/* Main Search Bar */}
              <div className="flex gap-3 mb-4">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                      <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={repository}
                    onChange={(e) => setRepository(e.target.value)}
                    placeholder="Enter repository (e.g. ceviixx/open-pulse)"
                    className="w-full pl-12 pr-4 py-3.5 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-900/50 dark:text-white transition-all text-base"
                    disabled={loading}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !repository}
                  className="px-6 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium shadow-lg shadow-blue-500/30 disabled:shadow-none flex items-center gap-2 whitespace-nowrap"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Analyzing...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span>Analyze</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowTokenInput(!showTokenInput)}
                  className="p-3.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition-all"
                  title={githubToken ? 'Token configured (5000/h)' : 'Add token (currently 60/h)'}
                >
                  {githubToken ? (
                    <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Token Input (Collapsible) */}
              {showTokenInput && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4 animate-in slide-in-from-top duration-200">
                  <div className="flex items-start gap-3 mb-3">
                    <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="flex-1 text-sm text-gray-600 dark:text-gray-400">
                      <p className="font-medium text-gray-900 dark:text-white mb-1">GitHub Personal Access Token (Optional)</p>
                      <p>Increase your rate limit from 60/h to 5000/h. Create a token at{' '}
                        <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                          github.com/settings/tokens
                        </a>
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={githubToken}
                      onChange={(e) => setGithubToken(e.target.value)}
                      placeholder="ghp_xxxxxxxxxxxx"
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-900/50 dark:text-white text-sm"
                    />
                    <button
                      type="button"
                      onClick={handleSaveToken}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
                    >
                      Save
                    </button>
                    {githubToken && (
                      <button
                        type="button"
                        onClick={() => {
                          localStorage.removeItem('github_token')
                          setGithubToken('')
                          setShowTokenInput(false)
                        }}
                        className="px-4 py-2 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/30 transition-colors font-medium text-sm"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              )}
            </form>

            {/* Error Message */}
            {error && (
                <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl">
                  <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <div className="flex-1">
                    <p className="font-medium">Analysis Error</p>
                    <p className="text-sm mt-1">{error}</p>
                  </div>
                </div>
              )}

              {loading && currentStatus && (
                <div className="space-y-4">
                  {/* Progress Bar */}
                  <div className="relative w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                    <div 
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500 ease-out shadow-lg"
                      style={{ width: `${currentStatus.progress}%` }}
                    >
                      <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                    </div>
                  </div>
                  
                  {/* Current Status */}
                  <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                    <div className="relative">
                      <svg className="animate-spin h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {currentStatus.message}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                        Step {Math.round(currentStatus.progress / 10)} of 10
                      </p>
                    </div>
                    <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                      {currentStatus.progress}%
                    </span>
                  </div>

                  {/* Status History */}
                  {statusMessages.length > 1 && (
                    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                        History
                      </p>
                      <div className="space-y-1.5 max-h-32 overflow-y-auto">
                        {[...statusMessages].reverse().map((status, idx) => (
                          <div 
                            key={statusMessages.length - 1 - idx} 
                            className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400"
                          >
                            <span className="flex-shrink-0 w-12 font-mono text-gray-400 dark:text-gray-500">
                              {status.progress}%
                            </span>
                            <span className="flex-1">{status.message}</span>
                            {idx === 0 && (
                              <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
          </div>
        </div>

        {/* Results */}
        {result && (
          <div className="space-y-8">
            {/* Repository Header Card */}
            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-8">
              <div className="flex items-start justify-between gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-gray-700 to-gray-900 dark:from-gray-600 dark:to-gray-800 rounded-xl flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                        {result.fullName}
                      </h2>
                      {result.description && (
                        <p className="text-gray-600 dark:text-gray-400 mt-1">
                          {result.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4 mt-4">
                    <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                      <svg className="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      <span className="font-semibold text-amber-700 dark:text-amber-300">
                        {result.stars.toLocaleString()}
                      </span>
                      <span className="text-amber-600 dark:text-amber-400 text-sm">Stars</span>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M7.707 3.293a1 1 0 010 1.414L5.414 7H11a7 7 0 017 7v2a1 1 0 11-2 0v-2a5 5 0 00-5-5H5.414l2.293 2.293a1 1 0 11-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span className="font-semibold text-blue-700 dark:text-blue-300">
                        {result.forks.toLocaleString()}
                      </span>
                      <span className="text-blue-600 dark:text-blue-400 text-sm">Forks</span>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                      <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      <span className="font-semibold text-green-700 dark:text-green-300">
                        {result.openIssuesCount.toLocaleString()}
                      </span>
                      <span className="text-green-600 dark:text-green-400 text-sm">Open Issues</span>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                      <svg className="w-5 h-5 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                      </svg>
                      <span className="font-semibold text-purple-700 dark:text-purple-300">
                        {result.openPullRequests.toLocaleString()}
                      </span>
                      <span className="text-purple-600 dark:text-purple-400 text-sm">Open PRs</span>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-700/20 rounded-lg border border-gray-200 dark:border-gray-700">
                      <svg className="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                        <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                      </svg>
                      <span className="font-semibold text-gray-700 dark:text-gray-300">
                        {result.watchers.toLocaleString()}
                      </span>
                      <span className="text-gray-600 dark:text-gray-400 text-sm">Watchers</span>
                    </div>
                  </div>
                </div>
                
                {/* Health Score Badge */}
                <div className="flex-shrink-0">
                  <div className="relative w-32 h-32">
                    <svg className="transform -rotate-90 w-32 h-32">
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        stroke="currentColor"
                        strokeWidth="10"
                        fill="none"
                        className="text-gray-200 dark:text-gray-700"
                      />
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        stroke="currentColor"
                        strokeWidth="10"
                        fill="none"
                        strokeDasharray={`${(result.healthScore / 100) * 352} 352`}
                        className={`transition-all duration-1000 ${
                          healthInfo?.color === 'green'
                            ? 'text-green-500'
                            : healthInfo?.color === 'blue'
                            ? 'text-blue-500'
                            : healthInfo?.color === 'yellow'
                            ? 'text-yellow-500'
                            : 'text-red-500'
                        }`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-4xl font-bold text-gray-900 dark:text-white">
                        {result.healthScore}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        Health
                      </span>
                    </div>
                  </div>
                  <p className="text-center mt-3 text-sm font-semibold" style={{
                    color: healthInfo?.color === 'green' ? '#10b981' :
                           healthInfo?.color === 'blue' ? '#3b82f6' :
                           healthInfo?.color === 'yellow' ? '#f59e0b' : '#ef4444'
                  }}>
                    {healthInfo?.label}
                  </p>
                </div>
              </div>
            </div>

            {/* Project Info Section */}
            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-8">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Project Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Last Commit */}
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Last Commit</p>
                    <p className="text-base font-bold text-gray-900 dark:text-white">
                      {new Date(result.lastCommitDate).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
                      {Math.floor((Date.now() - new Date(result.lastCommitDate).getTime()) / (1000 * 60 * 60 * 24))} days ago
                    </p>
                  </div>
                </div>

                {/* License */}
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">License</p>
                    <p className="text-base font-bold text-gray-900 dark:text-white">
                      {result.license || 'No License'}
                    </p>
                  </div>
                </div>

                {/* Languages */}
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">Languages</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(result.languages || {})
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 5)
                        .map(([lang, bytes]) => {
                          const totalBytes = Object.values(result.languages || {}).reduce((a, b) => a + b, 0)
                          const percentage = ((bytes / totalBytes) * 100).toFixed(1)
                          return (
                            <span 
                              key={lang}
                              className="px-2 py-1 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded text-xs font-medium"
                              title={`${percentage}%`}
                            >
                              {lang}
                            </span>
                          )
                        })}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Response Time */}
              <div className="group bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 transition-all duration-300">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">
                  Median Response Time
                </h4>
                <p className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                  {result.medianIssueResponseTime !== null
                    ? `${result.medianIssueResponseTime.toFixed(1)}h`
                    : 'N/A'}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Average time to first response
                </p>
              </div>

              {/* Issue Resolution */}
              <div className="group bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 transition-all duration-300">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">
                  Issue Resolution Rate
                </h4>
                <p className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                  {((result.closedIssuesCount / (result.openIssuesCount + result.closedIssuesCount)) * 100).toFixed(1)}%
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {result.closedIssuesCount} of {result.openIssuesCount + result.closedIssuesCount} issues closed
                </p>
              </div>

              {/* Commit Activity */}
              <div className="group bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 transition-all duration-300">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                  </div>
                </div>
                <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">
                  Commit Activity (90 Days)
                </h4>
                <p className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                  {result.totalCommitsLast90Days}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Commits in the last 3 months
                </p>
              </div>

              {/* Bus Factor */}
              <div className="group bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 transition-all duration-300">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                </div>
                <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">
                  Top Contributor Ratio
                </h4>
                <p className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                  {result.topContributorRatio.toFixed(1)}%
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Share of top contributor (lower is better)
                </p>
              </div>

              {/* Total Downloads */}
              <div className="group bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 transition-all duration-300">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                    </svg>
                  </div>
                </div>
                <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">
                  Total Downloads
                </h4>
                <p className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                  {result.totalDownloads.toLocaleString()}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Across all {result.totalReleases} releases
                </p>
              </div>

              {/* Release Activity */}
              <div className="group bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 transition-all duration-300">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-green-500 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                  </div>
                </div>
                <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">
                  Release Activity
                </h4>
                <p className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                  {result.releasesLast90Days}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  In the last 90 days
                </p>
              </div>
            </div>

            {/* Advanced Analytics Section */}
            <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl shadow-xl p-8 text-white">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold">Advanced Analytics</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Star Growth */}
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    <h4 className="text-lg font-semibold">Star Growth</h4>
                  </div>
                  <p className="text-3xl font-bold mb-1">
                    {result.starsPerMonth.toFixed(1)}
                  </p>
                  <p className="text-sm text-purple-100 mb-3">stars per month</p>
                  <div className="pt-3 border-t border-white/20">
                    <p className="text-2xl font-semibold">{result.recentStarGrowth}</p>
                    <p className="text-xs text-purple-100">in last 30 days</p>
                  </div>
                </div>

                {/* PR Merge Rate */}
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h4 className="text-lg font-semibold">PR Merge Rate</h4>
                  </div>
                  <p className="text-3xl font-bold mb-1">
                    {result.prMergeRate.toFixed(1)}%
                  </p>
                  <p className="text-sm text-purple-100">of PRs merged</p>
                  <div className="mt-4 bg-white/10 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-red-100 h-full transition-all duration-500"
                      style={{ width: `${result.prMergeRate}%` }}
                    />
                  </div>
                </div>

                {/* Code Frequency */}
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                    <h4 className="text-lg font-semibold">Code Activity</h4>
                  </div>
                  <p className="text-sm text-purple-100 mb-2">Last 12 weeks</p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm flex items-center gap-1">
                        <span className="text-green-300">+</span> Additions
                      </span>
                      <span className="font-semibold">{result.codeAdditions.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm flex items-center gap-1">
                        <span className="text-red-300">−</span> Deletions
                      </span>
                      <span className="font-semibold">{result.codeDeletions.toLocaleString()}</span>
                    </div>
                    <div className="pt-2 border-t border-white/20 flex items-center justify-between">
                      <span className="text-sm">Total Changes</span>
                      <span className="font-bold text-lg">{result.totalCodeChanges.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Releases Section */}
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-xl p-8 text-white">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold">Releases & Downloads</h3>
                </div>
                
                {result.totalReleases > 0 && (
                  <button
                    onClick={() => router.push(`/releases?repo=${result.owner}/${result.name}`)}
                    className="flex items-center gap-2 px-6 py-3 bg-white text-blue-600 rounded-xl hover:bg-blue-50 transition-all font-semibold shadow-lg group"
                  >
                    <span>View All</span>
                    <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                  <p className="text-3xl font-bold">
                    {result.totalReleases}
                  </p>
                  <p className="text-sm text-blue-100 mt-1">Total Releases</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                  <p className="text-3xl font-bold">
                    {result.releasesLast90Days}
                  </p>
                  <p className="text-sm text-blue-100 mt-1">Last 90 Days</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                  <p className="text-3xl font-bold">
                    {result.totalDownloads.toLocaleString()}
                  </p>
                  <p className="text-sm text-blue-100 mt-1">Total Downloads</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                  <p className="text-3xl font-bold">
                    {result.averageDownloadsPerRelease.toLocaleString()}
                  </p>
                  <p className="text-sm text-blue-100 mt-1">Avg per Release</p>
                </div>
              </div>
            </div>

            {/* Score Explanation */}
            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 rounded-2xl shadow-lg border border-indigo-200 dark:border-indigo-800 p-8">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    How is the Health Score calculated?
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    The score is composed of 5 equally weighted metrics (20 points each):
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-indigo-200 dark:border-indigo-800">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white text-sm mb-1">Response Time</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Faster response times = more points (&lt;24h = 20pts, &lt;48h = 16pts)
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-indigo-200 dark:border-indigo-800">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white text-sm mb-1">Issue Resolution</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Higher rate of closed issues = more points
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-indigo-200 dark:border-indigo-800">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white text-sm mb-1">Commit Activity</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        More commits in the last 90 days = active development
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-indigo-200 dark:border-indigo-800">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-4 h-4 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white text-sm mb-1">Bus Factor</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Lower concentration in top contributor = lower risk
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-indigo-200 dark:border-indigo-800 md:col-span-2">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-teal-100 dark:bg-teal-900/30 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-4 h-4 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white text-sm mb-1">Release Activity</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Recent releases show active maintenance (&lt;30d = 20pts, &lt;60d = 16pts)
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-16 text-center text-sm text-gray-500 dark:text-gray-400 space-y-2">
          <p className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span>100% Client-Side • No data is stored</span>
          </p>
          <p>
            <a
              href="https://github.com/ceviixx/repo-pulse"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
              </svg>
              View on GitHub
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
