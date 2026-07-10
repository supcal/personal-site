const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const repo = process.env.GITHUB_REPOSITORY || "supcal/personal-site";
const branch = process.env.GITHUB_BRANCH || "main";

const ignoredNames = new Set([
  ".git",
  ".agents",
  ".admin-auth.json",
  "node_modules",
  "server.log",
  "server-error.log"
]);

const ignoredPathParts = new Set(["backups"]);

function runGh(args, input) {
  const result = spawnSync("gh", args, {
    cwd: root,
    input,
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024
  });
  if (result.status !== 0) {
    const details = [result.stderr, result.stdout].filter(Boolean).join("\n");
    throw new Error(`gh ${args.join(" ")} failed\n${details}`);
  }
  return result.stdout.trim();
}

function ghJson(args, payload) {
  let inputPath = null;
  try {
    const finalArgs = [...args];
    if (payload) {
      inputPath = path.join(os.tmpdir(), `publish-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
      fs.writeFileSync(inputPath, JSON.stringify(payload), "utf8");
      finalArgs.push("--input", inputPath);
    }
    const output = runGh(finalArgs);
    return output ? JSON.parse(output) : {};
  } finally {
    if (inputPath && fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
  }
}

function shouldInclude(filePath) {
  const relative = path.relative(root, filePath);
  const parts = relative.split(path.sep);
  if (parts.some((part) => ignoredNames.has(part) || ignoredPathParts.has(part))) return false;
  if (parts.some((part) => part.startsWith(".admin-auth-test-") || part.startsWith(".deploy-"))) return false;
  return true;
}

function listFiles(dir) {
  const output = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (!shouldInclude(fullPath)) continue;
    if (entry.isDirectory()) {
      output.push(...listFiles(fullPath));
    } else if (entry.isFile()) {
      output.push(fullPath);
    }
  }
  return output;
}

function createBlob(filePath) {
  const content = fs.readFileSync(filePath).toString("base64");
  return ghJson(["api", `repos/${repo}/git/blobs`, "--method", "POST"], {
    content,
    encoding: "base64"
  });
}

function main() {
  runGh(["auth", "status"]);

  const ref = ghJson(["api", `repos/${repo}/git/ref/heads/${branch}`]);
  const baseCommit = ref.object.sha;
  const files = listFiles(root);
  const tree = files.map((filePath) => {
    const blob = createBlob(filePath);
    return {
      path: path.relative(root, filePath).replace(/\\/g, "/"),
      mode: "100644",
      type: "blob",
      sha: blob.sha
    };
  });

  const treeResponse = ghJson(["api", `repos/${repo}/git/trees`, "--method", "POST"], { tree });
  const commit = ghJson(["api", `repos/${repo}/git/commits`, "--method", "POST"], {
    message: "Publish academic profile site",
    tree: treeResponse.sha,
    parents: [baseCommit]
  });

  ghJson(["api", `repos/${repo}/git/refs/heads/${branch}`, "--method", "PATCH"], {
    sha: commit.sha,
    force: false
  });

  let pagesUrl = "";
  try {
    const pages = ghJson(["api", `repos/${repo}/pages`]);
    pagesUrl = pages.html_url || "";
  } catch (error) {
    pagesUrl = `https://${repo.split("/")[0]}.github.io/${repo.split("/")[1]}/`;
  }

  console.log(JSON.stringify({
    ok: true,
    repo,
    branch,
    commit: commit.sha,
    files: files.length,
    pagesUrl
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
