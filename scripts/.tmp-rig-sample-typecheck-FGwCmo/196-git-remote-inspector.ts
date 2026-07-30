import { agent, defineTool, p, s, repair } from "rig";

const parseRemoteLine = defineTool("parseRemoteLine", {
  description: "Parse a git remote -v output line into name, url, type, and protocol",
  parameters: s.object({ line: s.string }),
  handler({ line }) {
    const parts = line.split(/\s+/);
    const name = parts[0] ?? "";
    const url = parts[1] ?? "";
    const raw = parts[2] ?? "";
    const type: "fetch" | "push" = raw.includes("push") ? "push" : "fetch";
    let protocol: "https" | "ssh" | "git" | "unknown" = "unknown";
    if (url.startsWith("https://")) protocol = "https";
    else if (url.startsWith("git@") || url.startsWith("ssh://")) protocol = "ssh";
    else if (url.startsWith("git://")) protocol = "git";
    return { name, url, type, protocol };
  },
});

// Agent role: inspect git remotes and report their URLs, protocols, and remote branch count.
const gitRemoteInspector = agent({
  model: "typecheck",
  instructions: p`You are a git remote inspector.

Git remotes:
${p.bash("git remote -v")}

Remote branch count (origin):
${p.bash("git ls-remote --heads origin 2>/dev/null | wc -l")}

For each non-empty line in the remote output, use the parseRemoteLine tool.
Deduplicate entries that share the same name.
Report whether a remote named "origin" exists and the total remote branch count.`,
  tools: [parseRemoteLine],
  addons: [repair()],
  output: s.object({
    remotes: s.array(s.object({
      name: s.string,
      url: s.url,
      type: s.enum("fetch", "push"),
      protocol: s.enum("https", "ssh", "git", "unknown"),
    })),
    remoteBranchCount: s.int,
    hasOrigin: s.boolean,
  }),
});

export default gitRemoteInspector;
