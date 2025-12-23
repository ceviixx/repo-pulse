/**
 * GitHub API client for fetching repository data (Client-Side)
 * Works entirely in the browser without backend
 */

const GITHUB_API_BASE = 'https://api.github.com'

// Use NEXT_PUBLIC_ prefix for client-side env vars
const getGitHubToken = () => {
  if (typeof window === 'undefined') return null
  return process.env.NEXT_PUBLIC_GITHUB_TOKEN || localStorage.getItem('github_token')
}

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  }
  
  const token = getGitHubToken()
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  
  return headers
}

function getFetchOptions(): RequestInit {
  return {
    headers: getHeaders(),
    mode: 'cors',
    cache: 'no-cache',
  }
}

/**
 * Fetch with retry logic for better error handling
 */
async function fetchWithRetry(url: string, retries = 3, customOptions?: RequestInit): Promise<Response> {
  for (let i = 0; i <= retries; i++) {
    try {
      const options = customOptions || getFetchOptions()
      const response = await fetch(url, options)
      
      // On rate limit or server errors retry with exponential backoff
      if (response.status === 403 || response.status === 502 || response.status === 503 || response.status === 504 || response.status >= 500) {
        if (i < retries) {
          const delay = Math.min(1000 * Math.pow(2, i), 8000) // Max 8 seconds
          console.log(`⚠ ${response.status} error, retrying in ${delay}ms... (attempt ${i + 1}/${retries})`)
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
      }
      
      return response
    } catch (error) {
      if (i === retries) {
        console.error(`❌ Failed after ${retries} retries:`, error)
        throw error
      }
      // Exponential backoff
      const delay = Math.min(1000 * Math.pow(2, i), 8000)
      console.log(`⚠ Network error, retrying in ${delay}ms... (attempt ${i + 1}/${retries})`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  throw new Error('Max retries reached')
}

export interface GitHubRepository {
  id: number
  name: string
  full_name: string
  owner: {
    login: string
  }
  description: string | null
  stargazers_count: number
  forks_count: number
  open_issues_count: number
  watchers_count: number
  subscribers_count: number
  created_at: string
  updated_at: string
  license: {
    name: string
    spdx_id: string
  } | null
}

export interface GitHubIssue {
  number: number
  title: string
  state: 'open' | 'closed'
  created_at: string
  updated_at: string
  closed_at: string | null
  comments: number
  timeline_url: string
}

export interface GitHubCommit {
  sha: string
  commit: {
    author: {
      name: string
      email: string
      date: string
    }
    message: string
  }
  author: {
    login: string
  } | null
  stats?: {
    additions: number
    deletions: number
    total: number
  }
}

export interface GitHubIssueComment {
  id: number
  user: {
    login: string
    type: string
  }
  created_at: string
  body: string
}

export interface GitHubReleaseAsset {
  id: number
  name: string
  size: number
  download_count: number
  browser_download_url: string
  content_type: string
  created_at: string
}

export interface GitHubRelease {
  id: number
  tag_name: string
  name: string | null
  published_at: string
  prerelease: boolean
  draft: boolean
  body: string | null
  assets: GitHubReleaseAsset[]
  author: {
    login: string
  }
}

/**
 * Fetch repository information
 */
export async function fetchRepository(owner: string, repo: string): Promise<GitHubRepository> {
  const response = await fetchWithRetry(`${GITHUB_API_BASE}/repos/${owner}/${repo}`)

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Repository "${owner}/${repo}" not found. Please check the repository name and make sure it exists.`)
    }
    if (response.status === 403) {
      throw new Error(`Access denied to repository "${owner}/${repo}". The repository might be private or you've hit the rate limit.`)
    }
    throw new Error(`Failed to fetch repository "${owner}/${repo}": ${response.status} ${response.statusText}`)
  }

  return response.json()
}

/**
 * Fetch issues for a repository
 */
export async function fetchIssues(
  owner: string,
  repo: string,
  state: 'open' | 'closed' | 'all' = 'all',
  perPage: number = 100,
  onProgress?: (current: number, total: number) => void
): Promise<GitHubIssue[]> {
  const issues: GitHubIssue[] = []
  let page = 1
  
  while (issues.length < 500) { // Limit to prevent excessive API calls
    const response = await fetchWithRetry(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/issues?state=${state}&per_page=${perPage}&page=${page}`
    )

    if (!response.ok) {
      // On 404 or other errors: return what we have
      if (response.status === 404) {
        console.warn('Issues endpoint returned 404, repository may have issues disabled')
        break
      }
      throw new Error(`Failed to fetch issues: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    
    if (data.length === 0) break
    
    // Filter out pull requests (they appear in issues endpoint)
    const actualIssues = data.filter((issue: any) => !issue.pull_request)
    issues.push(...actualIssues)
    
    onProgress?.(issues.length, 500)
    
    if (data.length < perPage) break
    page++
  }

  return issues
}

/**
 * Fetch issue comments to calculate response time
 */
export async function fetchIssueComments(
  owner: string,
  repo: string,
  issueNumber: number
): Promise<GitHubIssueComment[]> {
  try {
    const response = await fetchWithRetry(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/issues/${issueNumber}/comments`
    )

    if (!response.ok) {
      if (response.status === 504 || response.status >= 500) {
        console.warn(`⚠ Server error ${response.status} for issue #${issueNumber} comments`)
        return []
      }
      throw new Error(`Failed to fetch issue comments: ${response.status}`)
    }

    return response.json()
  } catch (error) {
    console.warn(`⚠ Failed to fetch comments for issue #${issueNumber}:`, error)
    return []
  }
}

/**
 * Fetch commits for the last N days
 */
export async function fetchCommits(
  owner: string,
  repo: string,
  days: number = 90,
  onProgress?: (current: number, total: number) => void
): Promise<GitHubCommit[]> {
  const since = new Date()
  since.setDate(since.getDate() - days)
  
  const commits: GitHubCommit[] = []
  let page = 1
  const perPage = 100

  while (commits.length < 1000) { // Limit to prevent excessive API calls
    const response = await fetchWithRetry(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/commits?since=${since.toISOString()}&per_page=${perPage}&page=${page}`
    )

    if (!response.ok) {
      if (response.status === 504 || response.status >= 500) {
        console.warn(`⚠ Server error ${response.status}, stopping commits fetch`)
        break
      }
      throw new Error(`Failed to fetch commits: ${response.status}`)
    }

    const data = await response.json()
    
    if (data.length === 0) break
    
    commits.push(...data)
    
    onProgress?.(commits.length, 1000)
    
    if (data.length < perPage) break
    page++
  }

  return commits
}

/**
 * Fetch releases for a repository with full details including assets
 */
export async function fetchReleases(
  owner: string,
  repo: string,
  limit: number = 1000,
  onProgress?: (current: number, total: number) => void
): Promise<GitHubRelease[]> {
  const releases: GitHubRelease[] = []
  let page = 1
  const perPage = 100
  
  while (releases.length < limit) {
    const response = await fetchWithRetry(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/releases?per_page=${perPage}&page=${page}`
    )

    if (!response.ok) {
      if (response.status === 504 || response.status >= 500) {
        console.warn(`⚠ Server error ${response.status}, stopping releases fetch`)
        break
      }
      throw new Error(`Failed to fetch releases: ${response.status}`)
    }

    const data = await response.json()
    
    if (data.length === 0) break
    
    // Filter out drafts
    const validReleases = data.filter((release: GitHubRelease) => !release.draft)
    releases.push(...validReleases)
    
    onProgress?.(releases.length, limit)
    
    if (data.length < perPage) break
    page++
  }

  return releases
}

/**
 * Fetch repository languages
 */
export async function fetchLanguages(
  owner: string,
  repo: string
): Promise<Record<string, number>> {
  const response = await fetchWithRetry(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/languages`
  )

  if (!response.ok) {
    throw new Error(`Failed to fetch languages: ${response.status}`)
  }

  return response.json()
}

/**
 * Fetch open pull requests count using search API
 */
export async function fetchOpenPullRequestsCount(
  owner: string,
  repo: string
): Promise<number> {
  const response = await fetchWithRetry(
    `${GITHUB_API_BASE}/search/issues?q=repo:${owner}/${repo}+type:pr+is:open`
  )

  if (!response.ok) {
    throw new Error(`Failed to fetch PRs: ${response.status}`)
  }

  const data = await response.json()
  return data.total_count || 0
}

/**
 * Fetch PR merge statistics
 */
export async function fetchPRStats(
  owner: string,
  repo: string
): Promise<{ merged: number; closed: number; mergeRate: number }> {
  try {
    // Fetch merged PRs
    const mergedResponse = await fetchWithRetry(
      `${GITHUB_API_BASE}/search/issues?q=repo:${owner}/${repo}+type:pr+is:merged`
    )
    const mergedData = mergedResponse.ok ? await mergedResponse.json() : { total_count: 0 }
    
    // Fetch closed but not merged PRs
    const closedResponse = await fetchWithRetry(
      `${GITHUB_API_BASE}/search/issues?q=repo:${owner}/${repo}+type:pr+is:closed+is:unmerged`
    )
    const closedData = closedResponse.ok ? await closedResponse.json() : { total_count: 0 }
    
    const merged = mergedData.total_count || 0
    const closed = closedData.total_count || 0
    const total = merged + closed
    const mergeRate = total > 0 ? (merged / total) * 100 : 0
    
    return { merged, closed, mergeRate }
  } catch (error) {
    return { merged: 0, closed: 0, mergeRate: 0 }
  }
}

/**
 * Fetch stargazers with timestamps to calculate growth
 */
export async function fetchStarGrowth(
  owner: string,
  repo: string
): Promise<{ starsPerMonth: number; recentGrowth: number }> {
  try {
    // Fetch recent stargazers (last 100)
    const response = await fetchWithRetry(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/stargazers?per_page=100`,
      2,
      { headers: { ...getHeaders(), Accept: 'application/vnd.github.star+json' } as HeadersInit }
    )
    
    if (!response.ok) {
      return { starsPerMonth: 0, recentGrowth: 0 }
    }
    
    const stargazers = await response.json()
    
    if (stargazers.length === 0) {
      return { starsPerMonth: 0, recentGrowth: 0 }
    }
    
    // Calculate growth based on recent stargazers
    const now = Date.now()
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000
    
    const recentStars = stargazers.filter((s: any) => 
      new Date(s.starred_at).getTime() > thirtyDaysAgo
    ).length
    
    // Estimate monthly growth
    const starsPerMonth = recentStars
    const recentGrowth = recentStars
    
    return { starsPerMonth, recentGrowth }
  } catch (error) {
    return { starsPerMonth: 0, recentGrowth: 0 }
  }
}

/**
 * Fetch code frequency (additions/deletions)
 */
export async function fetchCodeFrequency(
  owner: string,
  repo: string
): Promise<{ additions: number; deletions: number; totalChanges: number }> {
  try {
    // Stats API may return 202 (computing), retry up to 3 times with delays
    let response
    let attempts = 0
    const maxAttempts = 3
    
    while (attempts < maxAttempts) {
      response = await fetchWithRetry(
        `${GITHUB_API_BASE}/repos/${owner}/${repo}/stats/code_frequency`
      )
      
      if (response.status === 202) {
        // Stats are being computed, wait and retry
        attempts++
        if (attempts < maxAttempts) {
          console.log(`⏳ Code stats computing, waiting 2s... (attempt ${attempts}/${maxAttempts})`)
          await new Promise(resolve => setTimeout(resolve, 2000))
          continue
        }
      }
      
      break
    }
    
    if (!response || !response.ok || response.status === 202) {
      console.warn('⚠ Code frequency stats not available yet')
      return { additions: 0, deletions: 0, totalChanges: 0 }
    }
    
    const data = await response.json()
    
    if (!Array.isArray(data) || data.length === 0) {
      return { additions: 0, deletions: 0, totalChanges: 0 }
    }
    
    // Get last 12 weeks of data
    const recentWeeks = data.slice(-12)
    
    let additions = 0
    let deletions = 0
    
    recentWeeks.forEach((week: [number, number, number]) => {
      additions += week[1] // additions are positive
      deletions += Math.abs(week[2]) // deletions are negative, make positive
    })
    
    return {
      additions,
      deletions,
      totalChanges: additions + deletions
    }
  } catch (error) {
    return { additions: 0, deletions: 0, totalChanges: 0 }
  }
}

/**
 * Check rate limit status
 */
export async function checkRateLimit() {
  const response = await fetch(
    `${GITHUB_API_BASE}/rate_limit`,
    getFetchOptions()
  )

  if (!response.ok) {
    throw new Error(`Failed to check rate limit: ${response.status}`)
  }

  return response.json()
}
