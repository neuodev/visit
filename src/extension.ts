import * as vscode from "vscode";
import Git from "simple-git";

function asLineStr(position: vscode.Position): `L${number}` {
  return `L${position.line + 1}`;
}

function asIdHref(start: vscode.Position, end: vscode.Position): string {
  return ["#", asLineStr(start), "-", asLineStr(end)].join("");
}

function getRootDir(): string | null {
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
    url: remote.refs.fetch.replace(".git", ""),
    branch,
  };
}

export function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.commands.registerTextEditorCommand(
    "visit.view",
    async (editor) => {
      const start = editor.selection.start;
      const end = editor.selection.end;
      const path = vscode.workspace.asRelativePath(editor.document.fileName);

      const rootDir = getRootDir();
      if (!rootDir) return;

      const remoteRef = await getRemoteRef(rootDir);
      if (!remoteRef) return;

      const fileUrl = remoteRef.url.concat(
        `/blob/${remoteRef.branch}/${path}`,
        asIdHref(start, end)
      );
      vscode.commands.executeCommand("vscode.open", fileUrl);
    }
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {}
