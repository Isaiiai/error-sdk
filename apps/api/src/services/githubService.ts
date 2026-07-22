import { config } from '../config';

export interface ParsedGitHubRepo {
  owner: string;
  repo: string;
  host: string;
}

export interface GitHubCommit {
  sha: string;
  shortSha: string;
  message: string;
  htmlUrl: string;
  authorName?: string;
  authorEmail?: string;
  date: Date;
}

export interface GitHubTag {
  name: string;
  commitSha: string;
  commitUrl?: string;
}

export function parseGitHubUrl(url: string): ParsedGitHubRepo {
  const cleaned = url.trim().replace(/\.git$/, '');
  // https://github.com/owner/repo or git@github.com:owner/repo
  const httpsMatch = cleaned.match(/github\.com[/:]([^/]+)\/([^/#?]+)/i);
  if (!httpsMatch) {
    const err = new Error('Invalid GitHub URL. Expected https://github.com/owner/repo') as Error & {
      status: number;
      code: string;
    };
    err.status = 400;
    err.code = 'INVALID_GITHUB_URL';
    throw err;
  }
  return {
    owner: httpsMatch[1],
    repo: httpsMatch[2],
    host: 'github.com',
  };
}

async function githubFetch<T>(path: string): Promise<T> {
  const pat = config.github.pat;
  if (!pat) {
    const err = new Error('GitHub PAT is not configured (GITHUB_PAT / git_pat)') as Error & {
      status: number;
      code: string;
    };
    err.status = 500;
    err.code = 'GITHUB_PAT_MISSING';
    throw err;
  }

  const res = await fetch(`${config.github.apiBase}${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${pat}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'error-tracker-api',
    },
  });

  if (!res.ok) {
    const body = await res.text();
    const err = new Error(
      `GitHub API error ${res.status}: ${body.slice(0, 200)}`
    ) as Error & { status: number; code: string };
    err.status = res.status === 401 || res.status === 403 ? 502 : res.status;
    err.code = 'GITHUB_API_ERROR';
    throw err;
  }

  return res.json() as Promise<T>;
}

export async function listCommits(
  owner: string,
  repo: string,
  options?: { branch?: string; perPage?: number }
): Promise<GitHubCommit[]> {
  const perPage = options?.perPage ?? 30;
  const query = new URLSearchParams({ per_page: String(perPage) });
  if (options?.branch) query.set('sha', options.branch);

  type ApiCommit = {
    sha: string;
    html_url: string;
    commit: {
      message: string;
      author?: { name?: string; email?: string; date?: string };
    };
  };

  const data = await githubFetch<ApiCommit[]>(
    `/repos/${owner}/${repo}/commits?${query.toString()}`
  );

  return data.map((c) => ({
    sha: c.sha,
    shortSha: c.sha.slice(0, 7),
    message: (c.commit.message || '').split('\n')[0],
    htmlUrl: c.html_url,
    authorName: c.commit.author?.name,
    authorEmail: c.commit.author?.email,
    date: c.commit.author?.date ? new Date(c.commit.author.date) : new Date(),
  }));
}

export async function listTags(owner: string, repo: string, perPage = 30): Promise<GitHubTag[]> {
  type ApiTag = { name: string; commit: { sha: string; url: string } };
  const data = await githubFetch<ApiTag[]>(
    `/repos/${owner}/${repo}/tags?per_page=${perPage}`
  );
  return data.map((t) => ({
    name: t.name,
    commitSha: t.commit.sha,
    commitUrl: t.commit.url,
  }));
}

export async function getCommit(
  owner: string,
  repo: string,
  ref: string
): Promise<GitHubCommit> {
  type ApiCommit = {
    sha: string;
    html_url: string;
    commit: {
      message: string;
      author?: { name?: string; email?: string; date?: string };
    };
  };
  const c = await githubFetch<ApiCommit>(`/repos/${owner}/${repo}/commits/${ref}`);
  return {
    sha: c.sha,
    shortSha: c.sha.slice(0, 7),
    message: (c.commit.message || '').split('\n')[0],
    htmlUrl: c.html_url,
    authorName: c.commit.author?.name,
    authorEmail: c.commit.author?.email,
    date: c.commit.author?.date ? new Date(c.commit.author.date) : new Date(),
  };
}

/** Create an annotated/lightweight tag pointing at a commit via GitHub API */
export async function createGitTag(params: {
  owner: string;
  repo: string;
  tagName: string;
  commitSha: string;
  message?: string;
}): Promise<{ tagName: string; commitSha: string; tagUrl: string }> {
  const pat = config.github.pat;
  if (!pat) {
    const err = new Error('GitHub PAT is not configured') as Error & { status: number; code: string };
    err.status = 500;
    err.code = 'GITHUB_PAT_MISSING';
    throw err;
  }

  // Create lightweight tag ref
  const res = await fetch(
    `${config.github.apiBase}/repos/${params.owner}/${params.repo}/git/refs`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${pat}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'error-tracker-api',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ref: `refs/tags/${params.tagName}`,
        sha: params.commitSha,
      }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    const err = new Error(`Failed to create git tag: ${body.slice(0, 200)}`) as Error & {
      status: number;
      code: string;
    };
    err.status = res.status;
    err.code = 'GITHUB_TAG_CREATE_FAILED';
    throw err;
  }

  return {
    tagName: params.tagName,
    commitSha: params.commitSha,
    tagUrl: `https://github.com/${params.owner}/${params.repo}/releases/tag/${params.tagName}`,
  };
}
