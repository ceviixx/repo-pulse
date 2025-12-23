'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { analyzeRepository, type ReleaseStats } from '@/lib/metrics'

function ReleasesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const repo = searchParams.get('repo')
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [releases, setReleases] = useState<ReleaseStats[]>([])
  const [repoInfo, setRepoInfo] = useState<{ owner: string; name: string } | null>(null)

  useEffect(() => {
    if (!repo) {
      router.push('/')
      return
    }

    const [owner, name] = repo.split('/')
    setRepoInfo({ owner, name })

    const fetchReleases = async () => {
      try {
        setLoading(true)
        
        // Try to load cached data first
        const cachedResult = localStorage.getItem('lastAnalysisResult')
        const cachedTimestamp = localStorage.getItem('lastAnalysisTimestamp')
        
        if (cachedResult && cachedTimestamp) {
          const age = Date.now() - parseInt(cachedTimestamp)
          const oneHour = 60 * 60 * 1000
          
          if (age < oneHour) {
            try {
              const parsed = JSON.parse(cachedResult)
              // Check if it's the same repo
              if (parsed.owner === owner && parsed.name === name) {
                setReleases(parsed.releases)
                setLoading(false)
                return
              }
            } catch (e) {
              // Ignore faulty cached data
            }
          }
        }
        
        // Fallback: Load data again
        const metrics = await analyzeRepository(owner, name)
        setReleases(metrics.releases)
        // Update Cache
        localStorage.setItem('lastAnalysisResult', JSON.stringify(metrics))
        localStorage.setItem('lastAnalysisTimestamp', Date.now().toString())
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load releases')
      } finally {
        setLoading(false)
      }
    }

    fetchReleases()
  }, [repo, router])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading releases...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-12 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline mb-4"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </button>
          
          <h1 className="text-4xl font-bold mb-2">
            Releases
          </h1>
          {repoInfo && (
            <p className="text-xl text-gray-600 dark:text-gray-400">
              {repoInfo.owner}/{repoInfo.name}
            </p>
          )}
        </div>

        {/* Releases List */}
        {releases.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
            <p className="text-gray-600 dark:text-gray-400">No releases found</p>
          </div>
        ) : (
          <div className="space-y-6">
            {releases.map((release, idx) => (
              <div
                key={idx}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow"
              >
                {/* Release Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-2xl font-bold">
                        {release.name}
                      </h3>
                      {release.isPrerelease && (
                        <span className="px-2 py-1 text-xs font-semibold bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 rounded">
                          Pre-release
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                      <span className="font-mono">{release.tag}</span>
                      <span>•</span>
                      <span>{formatDate(release.publishedAt)}</span>
                      <span>•</span>
                      <span>{release.daysAgo} days ago</span>
                    </div>
                  </div>
                  
                  {/* Total Downloads Badge */}
                  <div className="text-right">
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {release.totalDownloads.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      total downloads
                    </div>
                  </div>
                </div>

                {/* Assets */}
                {release.assets.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-3 text-gray-700 dark:text-gray-300">
                      Assets ({release.assetsCount})
                    </h4>
                    <div className="space-y-2">
                      {release.assets.map((asset, assetIdx) => (
                        <div
                          key={assetIdx}
                          className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900/70 transition-colors"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <svg
                              className="w-5 h-5 text-gray-400 flex-shrink-0"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                              />
                            </svg>
                            <span className="font-mono text-sm truncate">
                              {asset.name}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-6 ml-4">
                            <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                              {formatBytes(asset.size)}
                            </span>
                            <div className="flex items-center gap-2">
                              <svg
                                className="w-4 h-4 text-green-600 dark:text-green-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"
                                />
                              </svg>
                              <span className="text-sm font-semibold text-green-600 dark:text-green-400 whitespace-nowrap">
                                {asset.downloads.toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {release.assets.length === 0 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                    No assets available
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ReleasesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-slate-900 dark:to-indigo-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading releases...</p>
        </div>
      </div>
    }>
      <ReleasesContent />
    </Suspense>
  )
}
