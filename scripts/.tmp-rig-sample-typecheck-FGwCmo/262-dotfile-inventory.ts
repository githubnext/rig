import { agent, p, s, defineTool, repair } from "rig";

const categorizeDotfile = defineTool("categorizeDotfile", {
  description: "Categorize a dotfile by its filename into a purpose category.",
  parameters: s.object({ filename: s.string }),
  handler({ filename }) {
    const name = filename.replace(/^\./, "").toLowerCase();
    if (/^(bash|zsh|fish|profile|bashrc|zshrc|bash_profile|zprofile|inputrc)/.test(name))
      return { category: "shell" };
    if (/^(vimrc|vim|nvim|emacs|nano|editorconfig|prettierrc|eslintrc)/.test(name))
      return { category: "editor" };
    if (/^(gitconfig|gitignore|gitattributes|gitmessage|git)/.test(name))
      return { category: "git" };
    if (/^(ssh|known_hosts|authorized_keys)/.test(name))
      return { category: "ssh" };
    if (/^(npmrc|yarnrc|pnpmfile|curlrc|wgetrc|tmux|screenrc|docker)/.test(name))
      return { category: "tool" };
    return { category: "other" };
  },
});

// Agent role: Inventory dotfiles in the home directory and categorize each one.
const dotfileInventory = agent({
  model: "typecheck",
  addons: repair(),
  instructions: p`Inventory dotfiles in the home directory and categorize each.

Dotfiles found:
${p.bash("find ~ -maxdepth 1 -name '.*' -type f 2>/dev/null | head -40 || echo '(none found)'")}

For each dotfile found, call categorizeDotfile with its filename (basename).
Build a record keyed by filename with category and a short purpose description.
Also compute categorySummary as a record of category → count of dotfiles in that category.
Return dotfiles record, totalFound (integer count), and categorySummary.`,
  tools: [categorizeDotfile],
  output: s.object({
    dotfiles: s.record(
      s.object({
        category: s.enum("shell", "editor", "git", "ssh", "tool", "other"),
        purpose: s.string,
      })
    ),
    totalFound: s.int,
    categorySummary: s.record(s.int),
  }),
});

export default dotfileInventory;
