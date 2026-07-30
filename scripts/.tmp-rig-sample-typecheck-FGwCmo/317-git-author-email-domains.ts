import { agent, p, s, defineTool, steering } from "rig";

// Agent role: aggregate git commit author email domains and count commits per domain.
const gitAuthorEmailDomains = agent({
  model: "typecheck",
  instructions: p`You are a git author email domain aggregator.

Collect all author emails from the git log:
${p.bash("git log --format=%ae 2>/dev/null | sort | uniq -c | sort -rn || echo 'no commits'")}

For each unique email, call extractDomain to parse the domain.
Aggregate the results and return the declared output.`,
  tools: [
    defineTool("extractDomain", {
      description: "Extract the domain portion from an email address",
      parameters: s.object({ email: s.string }),
      handler({ email }) {
        const atIdx = email.indexOf("@");
        if (atIdx === -1) return { domain: "unknown" };
        return { domain: email.slice(atIdx + 1).toLowerCase() };
      },
    }),
  ],
  output: s.object({
    domains: s.record(s.int),
    totalAuthors: s.int,
    uniqueEmails: s.int,
    topDomain: s.string,
  }),
  addons: [steering()],
});

export default gitAuthorEmailDomains;
