import { agent, p, s, defineTool, repair } from "rig";

// Agent role: inspect git remote URLs and classify their protocol and type.
const gitRemoteUrlInspector = agent({
  model: "typecheck",
  instructions: p`You are a git remote URL inspector.

List all remotes and their URLs:
${p.bash("git remote -v 2>/dev/null || echo 'no remotes'")}

Count remote branches on origin:
${p.bash("git ls-remote --heads origin 2>/dev/null | wc -l || echo '0'")}

Use the parseRemoteLine tool for each remote line to extract protocol and type.
Return the declared output.`,
  tools: [
    defineTool("parseRemoteLine", {
      description: "Parse a git remote -v output line and extract name, url, protocol, and type",
      parameters: s.object({ line: s.string }),
      handler({ line }) {
        const match = line.match(/^(\S+)\s+(\S+)\s+\((\w+)\)$/);
        if (!match) return null;
        const [, name, url, type] = match;
        let protocol: "https" | "ssh" | "git" | "file";
        if (url.startsWith("https://")) protocol = "https" as const;
        else if (url.startsWith("git@") || url.startsWith("ssh://")) protocol = "ssh" as const;
        else if (url.startsWith("git://")) protocol = "git" as const;
        else protocol = "file" as const;
        return { name, url, type, protocol };
      },
    }),
  ],
  output: s.object({
    remotes: s.array(s.object({
      name: s.string,
      url: s.string,
      type: s.string,
      protocol: s.enum("https", "ssh", "git", "file"),
    })),
    remoteBranchCount: s.int,
    hasOrigin: s.boolean,
  }),
  addons: [repair()],
});

export default gitRemoteUrlInspector;
