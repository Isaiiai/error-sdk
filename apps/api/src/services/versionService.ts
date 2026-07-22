import { Types } from 'mongoose';
import { Project, IProject } from '../models/Project';
import * as github from './githubService';

type ProjectVersion = IProject['versions'][number];

function requireProject(project: IProject | null): IProject {
  if (!project) {
    const err = new Error('Project not found') as Error & { status: number; code: string };
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }
  return project;
}

function requireGitHubUrl(project: IProject): string {
  const url = project.maintenanceProfile?.githubUrl;
  if (!url) {
    const err = new Error('Project has no GitHub URL configured') as Error & {
      status: number;
      code: string;
    };
    err.status = 400;
    err.code = 'GITHUB_URL_MISSING';
    throw err;
  }
  return url;
}

function versionFromCommit(
  commit: github.GitHubCommit,
  extras?: Partial<ProjectVersion>
): ProjectVersion {
  return {
    _id: new Types.ObjectId(),
    version: extras?.version || `git-${commit.shortSha}`,
    description: extras?.description || commit.message,
    releaseDate: commit.date,
    status: extras?.status || 'released',
    changelog: extras?.changelog || commit.message,
    commitSha: commit.sha,
    commitShortSha: commit.shortSha,
    commitUrl: commit.htmlUrl,
    commitMessage: commit.message,
    authorName: commit.authorName,
    authorEmail: commit.authorEmail,
    branch: extras?.branch,
    tagName: extras?.tagName,
    source: extras?.source || 'git-commit',
  };
}

export async function listVersions(projectId: string) {
  const project = requireProject(await Project.findById(projectId));
  return [...(project.versions || [])].sort(
    (a, b) => new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime()
  );
}

export async function syncVersionsFromGit(
  projectId: string,
  options?: { includeCommits?: boolean; includeTags?: boolean; limit?: number }
) {
  const project = requireProject(await Project.findById(projectId));
  const githubUrl = requireGitHubUrl(project);
  const { owner, repo } = github.parseGitHubUrl(githubUrl);
  const branch = project.maintenanceProfile?.repositoryBranch || 'main';
  const limit = options?.limit ?? 20;
  const includeTags = options?.includeTags !== false;
  const includeCommits = options?.includeCommits !== false;

  const existingBySha = new Set(
    (project.versions || []).map((v) => v.commitSha).filter(Boolean) as string[]
  );
  const existingByTag = new Set(
    (project.versions || []).map((v) => v.tagName || v.version).filter(Boolean) as string[]
  );

  const added: ProjectVersion[] = [];

  if (includeTags) {
    const tags = await github.listTags(owner, repo, limit);
    for (const tag of tags) {
      if (existingByTag.has(tag.name) || existingBySha.has(tag.commitSha)) continue;
      const commit = await github.getCommit(owner, repo, tag.commitSha);
      const version = versionFromCommit(commit, {
        version: tag.name.replace(/^v/, '') === tag.name ? tag.name : tag.name,
        tagName: tag.name,
        source: 'git-tag',
        branch,
        status: /beta|rc|alpha/i.test(tag.name) ? 'beta' : 'released',
      });
      // Prefer semver-looking tag as version string
      version.version = tag.name;
      project.versions.push(version);
      existingBySha.add(tag.commitSha);
      existingByTag.add(tag.name);
      added.push(version);
    }
  }

  if (includeCommits) {
    const commits = await github.listCommits(owner, repo, { branch, perPage: limit });
    for (const commit of commits) {
      if (existingBySha.has(commit.sha)) continue;
      const version = versionFromCommit(commit, {
        branch,
        source: 'git-commit',
        status: 'released',
      });
      project.versions.push(version);
      existingBySha.add(commit.sha);
      added.push(version);
    }
  }

  await project.save();

  return {
    added: added.length,
    total: project.versions.length,
    versions: added,
    repo: `${owner}/${repo}`,
    branch,
  };
}

export async function createVersionFromCommit(
  projectId: string,
  input: {
    commitRef?: string;
    version?: string;
    createGitTag?: boolean;
    tagName?: string;
    status?: 'released' | 'beta' | 'deprecated';
    changelog?: string;
  }
) {
  const project = requireProject(await Project.findById(projectId));
  const githubUrl = requireGitHubUrl(project);
  const { owner, repo } = github.parseGitHubUrl(githubUrl);
  const branch = project.maintenanceProfile?.repositoryBranch || 'main';
  const ref = input.commitRef || branch;

  const commit = await github.getCommit(owner, repo, ref);

  const existing = project.versions.find((v) => v.commitSha === commit.sha);
  if (existing && !input.version && !input.createGitTag) {
    return { version: existing, created: false };
  }

  let tagName = input.tagName || input.version;
  if (input.createGitTag) {
    if (!tagName) {
      const err = new Error('tagName or version is required to create a git tag') as Error & {
        status: number;
        code: string;
      };
      err.status = 400;
      err.code = 'TAG_NAME_REQUIRED';
      throw err;
    }
    await github.createGitTag({
      owner,
      repo,
      tagName,
      commitSha: commit.sha,
      message: input.changelog || commit.message,
    });
  }

  const version = versionFromCommit(commit, {
    version: input.version || tagName || `git-${commit.shortSha}`,
    tagName: tagName,
    source: input.createGitTag || tagName ? 'git-tag' : 'git-commit',
    status: input.status || 'released',
    changelog: input.changelog || commit.message,
    branch,
  });

  project.versions.push(version);
  await project.save();

  return { version, created: true, gitTagCreated: !!input.createGitTag };
}

export async function addManualVersion(
  projectId: string,
  input: {
    version: string;
    description?: string;
    changelog?: string;
    status?: 'released' | 'beta' | 'deprecated';
    commitSha?: string;
  }
) {
  const project = requireProject(await Project.findById(projectId));

  let commitMeta: Partial<ProjectVersion> = {};
  if (input.commitSha && project.maintenanceProfile?.githubUrl) {
    const { owner, repo } = github.parseGitHubUrl(project.maintenanceProfile.githubUrl);
    const commit = await github.getCommit(owner, repo, input.commitSha);
    commitMeta = {
      commitSha: commit.sha,
      commitShortSha: commit.shortSha,
      commitUrl: commit.htmlUrl,
      commitMessage: commit.message,
      authorName: commit.authorName,
      authorEmail: commit.authorEmail,
      source: 'git-commit',
    };
  }

  const version: ProjectVersion = {
    _id: new Types.ObjectId(),
    version: input.version,
    description: input.description || input.changelog,
    releaseDate: new Date(),
    status: input.status || 'released',
    changelog: input.changelog,
    source: commitMeta.source || 'manual',
    ...commitMeta,
  };

  project.versions.push(version);
  await project.save();
  return version;
}

export async function listGitCommits(projectId: string, limit = 20) {
  const project = requireProject(await Project.findById(projectId));
  const githubUrl = requireGitHubUrl(project);
  const { owner, repo } = github.parseGitHubUrl(githubUrl);
  const branch = project.maintenanceProfile?.repositoryBranch || 'main';
  const commits = await github.listCommits(owner, repo, { branch, perPage: limit });
  return { repo: `${owner}/${repo}`, branch, commits };
}
