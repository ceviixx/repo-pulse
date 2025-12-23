/**
 * Metrics calculation module
 * Contains all logic for analyzing repository health
 */

import {
  fetchRepository,
  fetchIssues,
  fetchIssueComments,
  fetchCommits,
  fetchReleases,
  fetchLanguages,
  fetchOpenPullRequestsCount,
  fetchPRStats,
  fetchStarGrowth,
  fetchCodeFrequency,
  type GitHubIssue,
  type GitHubCommit,
  type GitHubRelease,
  type GitHubReleaseAsset,
} from './github'

export interface ReleaseStats {
  tag: string
  name: string
  publishedAt: string
  daysAgo: number
  totalDownloads: number
  assetsCount: number
  isPrerelease: boolean
  assets: Array<{
    name: string
    size: number
    downloads: number
  }>
}

export interface RepositoryMetrics {
  // Basic info
  owner: string
  name: string
  fullName: string
  description: string | null
  stars: number
  forks: number
  openIssues: number

  // Calculated metrics
  medianIssueResponseTime: number | null // in hours
  openIssuesCount: number
  closedIssuesCount: number
  totalCommitsLast90Days: number
  topContributorRatio: number // percentage (0-100)
  
  // Release metrics
  releases: ReleaseStats[]
  totalReleases: number
  releasesLast90Days: number
  totalDownloads: number
  averageDownloadsPerRelease: number
  latestRelease: ReleaseStats | null
  
  // Additional metrics
  watchers: number
  lastCommitDate: string
  openPullRequests: number
  license: string | null
  languages: Record<string, number>
  
  // Advanced analytics
  starsPerMonth: number
  recentStarGrowth: number // stars in last 30 days
  prMergeRate: number // percentage (0-100)
  codeAdditions: number // last 12 weeks
  codeDeletions: number // last 12 weeks
  totalCodeChanges: number // last 12 weeks
  
  healthScore: number // 0-100
}

export type AnalysisStatus = {
  step: string
  message: string
  progress: number // 0-100
}

export type StatusCallback = (status: AnalysisStatus) => void

/**
 * Calculate median from an array of numbers
 */
function calculateMedian(values: number[]): number | null {
  if (values.length === 0) return null

  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2
  }

  return sorted[middle]
}

/**
 * Calculate response time for an issue (time until first comment by a maintainer/contributor)
 */
async function calculateIssueResponseTime(
  owner: string,
  repo: string,
  issue: GitHubIssue
): Promise<number | null> {
  try {
    const comments = await fetchIssueComments(owner, repo, issue.number)

    if (comments.length === 0) return null

    // Get first comment that's not from the issue creator
    const firstResponse = comments.find((comment) => comment.user.type === 'User')

    if (!firstResponse) return null

    const issueCreated = new Date(issue.created_at).getTime()
    const firstResponseTime = new Date(firstResponse.created_at).getTime()

    // Return response time in hours
    return (firstResponseTime - issueCreated) / (1000 * 60 * 60)
  } catch (error) {
    console.error(`Failed to calculate response time for issue #${issue.number}:`, error)
    return null
  }
}

/**
 * Calculate median issue response time
 * Samples a subset of recent closed issues to avoid excessive API calls
 */
async function calculateMedianIssueResponseTime(
  owner: string,
  repo: string,
  issues: GitHubIssue[]
): Promise<number | null> {
  // Sample nur 5 recent closed issues (reduziert API-Aufrufe deutlich)
  const closedIssues = issues
    .filter((issue) => issue.state === 'closed' && issue.comments > 0)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5)

  if (closedIssues.length === 0) return null

  const responseTimes: number[] = []

  for (const issue of closedIssues) {
    const responseTime = await calculateIssueResponseTime(owner, repo, issue)
    if (responseTime !== null) {
      responseTimes.push(responseTime)
    }

    // Kleiner delay zwischen Requests um Server nicht zu überlasten
    await new Promise(resolve => setTimeout(resolve, 200))
  }

  return calculateMedian(responseTimes)
}

/**
 * Calculate top contributor ratio (bus factor indicator)
 */
function calculateTopContributorRatio(commits: GitHubCommit[]): number {
  if (commits.length === 0) return 0

  const contributorCounts = new Map<string, number>()

  for (const commit of commits) {
    const author = commit.author?.login || commit.commit.author.email
    contributorCounts.set(author, (contributorCounts.get(author) || 0) + 1)
  }

  // Find top contributor
  let maxCommits = 0
  for (const count of contributorCounts.values()) {
    if (count > maxCommits) {
      maxCommits = count
    }
  }

  // Return as percentage
  return (maxCommits / commits.length) * 100
}

/**
 * Calculate release statistics with download counts
 */
function calculateReleaseStats(releases: GitHubRelease[]): {
  releases: ReleaseStats[]
  totalReleases: number
  releasesLast90Days: number
  totalDownloads: number
  averageDownloadsPerRelease: number
  latestRelease: ReleaseStats | null
} {
  const now = Date.now()
  const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000

  const releaseStats: ReleaseStats[] = releases.map(release => {
    const totalDownloads = release.assets.reduce((sum, asset) => sum + asset.download_count, 0)
    const daysAgo = Math.floor((now - new Date(release.published_at).getTime()) / (1000 * 60 * 60 * 24))
    
    return {
      tag: release.tag_name,
      name: release.name || release.tag_name,
      publishedAt: release.published_at,
      daysAgo,
      totalDownloads,
      assetsCount: release.assets.length,
      isPrerelease: release.prerelease,
      assets: release.assets.map(asset => ({
        name: asset.name,
        size: asset.size,
        downloads: asset.download_count,
      })),
    }
  })

  const recentReleases = releaseStats.filter(r => {
    const publishedAt = new Date(r.publishedAt).getTime()
    return publishedAt >= ninetyDaysAgo && !r.isPrerelease
  })

  const totalDownloads = releaseStats.reduce((sum, r) => sum + r.totalDownloads, 0)
  const nonPrereleases = releaseStats.filter(r => !r.isPrerelease)

  return {
    releases: releaseStats,
    totalReleases: nonPrereleases.length,
    releasesLast90Days: recentReleases.length,
    totalDownloads,
    averageDownloadsPerRelease: nonPrereleases.length > 0 
      ? Math.round(totalDownloads / nonPrereleases.length) 
      : 0,
    latestRelease: nonPrereleases.length > 0 ? nonPrereleases[0] : null,
  }
}

/**
 * Calculate overall health score (0-100)
 * 
 * Scoring logic:
 * - Response Time: 20 points (faster is better)
 * - Issue Resolution: 20 points (more closed vs open is better)
 * - Commit Activity: 20 points (consistent activity is better)
 * - Bus Factor: 20 points (lower top contributor ratio is better)
 * - Release Activity: 20 points (recent releases indicate maintenance)
 */
function calculateHealthScore(metrics: Omit<RepositoryMetrics, 'healthScore'>): number {
  let score = 0

  // 1. Response Time Score (20 points)
  if (metrics.medianIssueResponseTime !== null) {
    if (metrics.medianIssueResponseTime < 24) score += 20
    else if (metrics.medianIssueResponseTime < 48) score += 16
    else if (metrics.medianIssueResponseTime < 72) score += 12
    else if (metrics.medianIssueResponseTime < 168) score += 8
    else score += 4
  } else {
    score += 10
  }

  // 2. Issue Resolution Score (20 points)
  const totalIssues = metrics.openIssuesCount + metrics.closedIssuesCount
  if (totalIssues > 0) {
    const closedRatio = metrics.closedIssuesCount / totalIssues
    score += Math.round(closedRatio * 20)
  } else {
    score += 10
  }

  // 3. Commit Activity Score (20 points)
  if (metrics.totalCommitsLast90Days >= 100) score += 20
  else if (metrics.totalCommitsLast90Days >= 50) score += 16
  else if (metrics.totalCommitsLast90Days >= 20) score += 12
  else if (metrics.totalCommitsLast90Days >= 10) score += 8
  else score += Math.round((metrics.totalCommitsLast90Days / 10) * 8)

  // 4. Bus Factor Score (20 points)
  if (metrics.topContributorRatio < 40) score += 20
  else if (metrics.topContributorRatio < 50) score += 16
  else if (metrics.topContributorRatio < 60) score += 12
  else if (metrics.topContributorRatio < 70) score += 8
  else score += 4

  // 5. Release Activity Score (20 points)
  if (metrics.latestRelease) {
    const daysAgo = metrics.latestRelease.daysAgo
    if (daysAgo <= 30) score += 20
    else if (daysAgo <= 60) score += 16
    else if (daysAgo <= 90) score += 12
    else if (daysAgo <= 180) score += 8
    else score += 4
  } else {
    score += 4
  }

  return Math.min(100, Math.max(0, score))
}

/**
 * Analyze a repository and calculate all metrics
 * Continues even if individual requests fail
 */
export async function analyzeRepository(
  owner: string, 
  repo: string,
  onProgress?: StatusCallback
): Promise<RepositoryMetrics> {
  console.log(`Analyzing repository: ${owner}/${repo}`)
  
  onProgress?.({ step: 'init', message: 'Starting analysis...', progress: 0 })

  // Fetch repository data (this is critical - must succeed)
  let repository
  try {
    onProgress?.({ step: 'repo', message: 'Fetching repository info...', progress: 10 })
    repository = await fetchRepository(owner, repo)
    console.log(`✓ Fetched repository info`)
    onProgress?.({ step: 'repo', message: '✓ Repository info fetched', progress: 15 })
  } catch (error) {
    throw new Error(`Failed to fetch repository: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  // Fetch issues (optional - continue if fails)
  let issues: GitHubIssue[] = []
  try {
    onProgress?.({ step: 'issues', message: 'Fetching issues...', progress: 20 })
    issues = await fetchIssues(owner, repo, 'all', 100, (current, total) => {
      const progressPercent = 20 + Math.floor((current / total) * 10)
      onProgress?.({ step: 'issues', message: `Fetching issues (${current})...`, progress: progressPercent })
    })
    console.log(`✓ Fetched ${issues.length} issues`)
    onProgress?.({ step: 'issues', message: `✓ Fetched ${issues.length} issues`, progress: 30 })
  } catch (error) {
    console.warn(`⚠ Failed to fetch issues, continuing without issue data`)
    onProgress?.({ step: 'issues', message: '⚠ Failed to fetch issues', progress: 30 })
  }

  // Get accurate issue counts using GitHub Search API
  let openIssuesCount = repository.open_issues_count
  let closedIssuesCount = 0
  
  try {
    onProgress?.({ step: 'issue-counts', message: 'Getting issue statistics...', progress: 32 })
    const closedResponse = await fetch(
      `https://api.github.com/search/issues?q=repo:${owner}/${repo}+type:issue+is:closed`,
      { headers: { Accept: 'application/vnd.github.v3+json' } }
    )
    if (closedResponse.ok) {
      const closedData = await closedResponse.json()
      closedIssuesCount = closedData.total_count
      console.log(`✓ Found ${openIssuesCount} open and ${closedIssuesCount} closed issues`)
    }
  } catch (error) {
    console.warn(`⚠ Failed to get accurate issue counts, using fetched issues`)
    // Fallback to counting fetched issues
    openIssuesCount = issues.filter((i) => i.state === 'open').length
    closedIssuesCount = issues.filter((i) => i.state === 'closed').length
  }

  // Fetch commits (optional - continue if fails)
  let commits: GitHubCommit[] = []
  try {
    onProgress?.({ step: 'commits', message: 'Fetching commits...', progress: 40 })
    commits = await fetchCommits(owner, repo, 90, (current, total) => {
      const progressPercent = 40 + Math.floor((current / total) * 15)
      onProgress?.({ step: 'commits', message: `Fetching commits (${current})...`, progress: progressPercent })
    })
    console.log(`✓ Fetched ${commits.length} commits`)
    onProgress?.({ step: 'commits', message: `✓ Fetched ${commits.length} commits`, progress: 55 })
  } catch (error) {
    console.warn(`⚠ Failed to fetch commits, continuing without commit data`)
    onProgress?.({ step: 'commits', message: '⚠ Failed to fetch commits', progress: 55 })
  }

  // Fetch releases (optional - continue if fails)
  let releases: GitHubRelease[] = []
  try {
    onProgress?.({ step: 'releases', message: 'Fetching releases...', progress: 55 })
    releases = await fetchReleases(owner, repo, 1000, (current, total) => {
      const progressPercent = 55 + Math.floor((current / total) * 10)
      onProgress?.({ step: 'releases', message: `Fetching releases (${current})...`, progress: progressPercent })
    })
    console.log(`✓ Fetched ${releases.length} releases`)
    onProgress?.({ step: 'releases', message: `✓ Fetched ${releases.length} releases`, progress: 65 })
  } catch (error) {
    console.warn(`⚠ Failed to fetch releases, continuing without release data`)
    onProgress?.({ step: 'releases', message: '⚠ Failed to fetch releases', progress: 65 })
  }

  // Calculate metrics with available data
  let medianIssueResponseTime: number | null = null
  if (issues.length > 0) {
    try {
      onProgress?.({ step: 'response-time', message: 'Calculating response times...', progress: 70 })
      console.log(`Calculating median response time...`)
      medianIssueResponseTime = await calculateMedianIssueResponseTime(owner, repo, issues)
      console.log(`✓ Median response time: ${medianIssueResponseTime?.toFixed(2) || 'N/A'} hours`)
      onProgress?.({ step: 'response-time', message: '✓ Response time calculated', progress: 85 })
    } catch (error) {
      console.warn(`⚠ Failed to calculate response time, continuing without this metric`)
      onProgress?.({ step: 'response-time', message: '⚠ Response time calculation failed', progress: 85 })
    }
  }

  const totalCommitsLast90Days = commits.length
  const topContributorRatio = calculateTopContributorRatio(commits)
  const releaseStats = calculateReleaseStats(releases)

  // Fetch additional metrics
  let languages: Record<string, number> = {}
  let openPullRequests = 0
  
  try {
    onProgress?.({ step: 'additional', message: 'Fetching additional data...', progress: 87 })
    
    // Fetch languages with proper authentication
    languages = await fetchLanguages(owner, repo)
    console.log(`✓ Fetched ${Object.keys(languages).length} languages`)
    
    // Fetch open PRs count with proper authentication
    openPullRequests = await fetchOpenPullRequestsCount(owner, repo)
    console.log(`✓ Found ${openPullRequests} open pull requests`)
  } catch (error) {
    console.warn(`⚠ Failed to fetch additional metrics:`, error)
  }

  // Fetch advanced analytics
  let starsPerMonth = 0
  let recentStarGrowth = 0
  let prMergeRate = 0
  let codeAdditions = 0
  let codeDeletions = 0
  let totalCodeChanges = 0
  
  try {
    onProgress?.({ step: 'analytics', message: 'Analyzing star growth...', progress: 90 })
    const starGrowth = await fetchStarGrowth(owner, repo)
    starsPerMonth = starGrowth.starsPerMonth
    recentStarGrowth = starGrowth.recentGrowth
    console.log(`✓ Star growth: ${starsPerMonth.toFixed(1)}/month, ${recentStarGrowth} recent`)
    
    onProgress?.({ step: 'analytics', message: 'Calculating PR merge rate...', progress: 93 })
    const prStats = await fetchPRStats(owner, repo)
    prMergeRate = prStats.mergeRate
    console.log(`✓ PR merge rate: ${prMergeRate.toFixed(1)}% (${prStats.merged}/${prStats.merged + prStats.closed})`)
    
    onProgress?.({ step: 'analytics', message: 'Analyzing code frequency...', progress: 96 })
    const codeFreq = await fetchCodeFrequency(owner, repo)
    codeAdditions = codeFreq.additions
    codeDeletions = codeFreq.deletions
    totalCodeChanges = codeFreq.totalChanges
    console.log(`✓ Code activity: +${codeAdditions} -${codeDeletions} (last 12 weeks)`)
  } catch (error) {
    console.warn(`⚠ Failed to fetch advanced analytics:`, error)
  }

  const metricsData = {
    owner,
    name: repository.name,
    fullName: repository.full_name,
    description: repository.description,
    stars: repository.stargazers_count,
    forks: repository.forks_count,
    openIssues: repository.open_issues_count,
    medianIssueResponseTime,
    openIssuesCount,
    closedIssuesCount,
    totalCommitsLast90Days,
    topContributorRatio,
    watchers: repository.subscribers_count || 0,
    lastCommitDate: commits.length > 0 ? commits[0].commit.author.date : repository.updated_at,
    openPullRequests,
    license: repository.license?.name || null,
    languages,
    starsPerMonth,
    recentStarGrowth,
    prMergeRate,
    codeAdditions,
    codeDeletions,
    totalCodeChanges,
    ...releaseStats,
  }

  onProgress?.({ step: 'calculating', message: 'Calculating health score...', progress: 98 })
  const healthScore = calculateHealthScore(metricsData)
  console.log(`✓ Health score: ${healthScore}/100`)
  
  onProgress?.({ step: 'complete', message: '✓ Analysis complete!', progress: 100 })

  return {
    ...metricsData,
    healthScore,
  }
}

/**
 * Get health score interpretation
 */
export function getHealthScoreInterpretation(score: number): {
  label: string
  description: string
  color: string
} {
  if (score >= 80) {
    return {
      label: 'Excellent',
      description: 'This project is very healthy with active maintenance and community engagement.',
      color: 'green',
    }
  } else if (score >= 60) {
    return {
      label: 'Good',
      description: 'This project is generally well-maintained with room for improvement.',
      color: 'blue',
    }
  } else if (score >= 40) {
    return {
      label: 'Fair',
      description: 'This project shows some signs of maintenance but may have concerns.',
      color: 'yellow',
    }
  } else {
    return {
      label: 'Needs Attention',
      description: 'This project may have maintenance or community engagement concerns.',
      color: 'red',
    }
  }
}
