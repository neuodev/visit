import * as vscode from "vscode";
import Git from "simple-git";
import fs from "node:fs";
import path from "node:path";
import "colors";

// handle gitlab and github
// handle https and ssh

function asRemoteUrl(ref: string) {
  const trimmed = ref.replace(".git", "");
  if (trimmed.startsWith("git@gitlab.com"))
    return trimmed.replace("git@gitlab.com:", "https://gitlab.com/") + "/-";

  if (trimmed.startsWith("git@github.com:"))
    return trimmed.replace("git@github.com:", "https://github.com/");

  // https
  return ref;
}

function withErrLog(msg: string): void {
  console.debug(`[visit]: error - ${msg}`.red.bold);
}

function withDevLog(msg: string): void {
  console.debug(`[visit]: info - ${msg}`.cyan.bold);
}

function asLineStr(position: vscode.Position): `L${number}` {
  return `L${position.line + 1}`;
}

function asIdHref(start: vscode.Position, end: vscode.Position): string {
  return ["#", asLineStr(start), "-", asLineStr(end)].join("");
}

function hasDotGit(dir: string): boolean {
  return !!fs.readdirSync(dir).find((file) => file === ".git");
}

function findRepoRootDirPath(dir: string): string | null {
  let currentDir = dir;

  while (!hasDotGit(currentDir)) {
    currentDir = path.resolve(currentDir, "..");
    const isRoot = path.parse(process.cwd()).dir === "";
    if (isRoot) return null;
  }

  return currentDir;
}

function asRemoteRepoFilePath(
  absFilePath: string,
  repoRootDir: string
): string {
  return absFilePath.replace(repoRootDir, "");
}

function getCurrentDir(): string | null {
  const workspaces = vscode.workspace.workspaceFolders;
  if (!workspaces || workspaces.length === 0) return null;
  const [workspace] = workspaces;
  return workspace.uri.path;
}

async function getRemoteRef(
  rootDir: string
): Promise<{ url: string; branch: string } | null> {
  const git = Git(rootDir);
  const { current: branch } = await git.branch();
  const remotes = await git.getRemotes(true);
  if (remotes.length === 0) return null;
  const remote = remotes[0];

  return {
    url: asRemoteUrl(remote.refs.fetch),
    branch,
  };
}

async function getSelectionUrl(editor: vscode.TextEditor) {
  const start = editor.selection.start;
  const end = editor.selection.end;
  const absFilePath = editor.document.fileName;

  withDevLog(`fullpath - ${absFilePath}`);

  const currentDir = getCurrentDir();
  if (!currentDir)
    return withErrLog("unable to find the current directory path");

  withDevLog(`currentDir - ${currentDir}`);

  const repoRootDir = findRepoRootDirPath(currentDir);
  if (!repoRootDir) return withErrLog("unable to find the repo root directory");

  withDevLog(`repoRootDir - ${repoRootDir}`);

  const remoteRef = await getRemoteRef(repoRootDir);
  if (!remoteRef) return withErrLog("unable to find remote ref");

  withDevLog(`remoteRef - ${remoteRef.url} ${remoteRef.branch}`);

  const fileUrl = remoteRef.url.concat(
    `/blob/${remoteRef.branch}`,
    asRemoteRepoFilePath(absFilePath, repoRootDir),
    asIdHref(start, end)
  );

  withDevLog(`url - ${fileUrl}`);

  return fileUrl;
}

export function activate(context: vscode.ExtensionContext) {
  const view = vscode.commands.registerTextEditorCommand(
    "visit.view",
    async (editor) => {
      const url = await getSelectionUrl(editor);
      if (!url) return;
      vscode.commands.executeCommand("vscode.open", url);
    }
  );

  const copy = vscode.commands.registerTextEditorCommand(
    "visit.copy",
    async (editor) => {
      const url = await getSelectionUrl(editor);
      if (!url) return;
      await vscode.env.clipboard.writeText(url);
      vscode.window.showInformationMessage("Link copied!!");
    }
  );

  context.subscriptions.push(view, copy);
}

export function deactivate() {}
