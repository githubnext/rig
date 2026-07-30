import { agent, p, s, defineTool, repair } from "rig";

const categorizeDotfile = defineTool("categorizeDotfile", {
  description: "Categorize a dotfile by its filename into a purpose and category.",
  parameters: s.object({ filename: s.string }),
  handler({ filename }) {
    const f = filename.toLowerCase();
    if (f.includes("bash") || f.includes("zsh") || f.includes("fish") || f.includes("profile") || f.includes("aliases")) {
      return { purpose: "Shell configuration and aliases", category: "shell" as const };
    }
    if (f.includes("vim") || f.includes("emacs") || f.includes("vscode") || f.includes("editorconfig") || f.includes("nvim")) {
      return { purpose: "Editor settings and configuration", category: "editor" as const };
    }
    if (f.includes("git") || f.includes("gitconfig") || f.includes("gitignore")) {
      return { purpose: "Git version control configuration", category: "git" as const };
    }
    if (f.includes("ssh") || f.includes("gnupg") || f.includes("gpg")) {
      return { purpose: "SSH or GPG security configuration", category: "ssh" as const };
    }
    if (f.includes("npm") || f.includes("yarn") || f.includes("pip") || f.includes("cargo") || f.includes("gem")) {
      return { purpose: "Package manager settings", category: "package-manager" as const };
    }
    return { purpose: "Miscellaneous dotfile configuration", category: "misc" as const };
  },
});

// Agent role: inventory dotfiles in the home directory and categorize them by purpose.
const dotfileInventoryMapper = agent({
  model: "typecheck",
  addons: repair(),
  instructions: p`Inventory dotfiles found in the home directory.

Discovered dotfiles:
${p.bash("find ~ -maxdepth 2 -name '.*' -type f 2>/dev/null | head -50")}

For each file path, call categorizeDotfile with just the filename (basename).
Build the dotfiles record keyed by filename with purpose and category.
Count totalFound (number of entries in dotfiles).
Build categorySummary as a record of category -> count of files in that category.`,
  tools: [categorizeDotfile],
  output: s.object({
    dotfiles: s.record(
      s.object({
        purpose: s.string,
        category: s.enum("shell", "editor", "git", "ssh", "package-manager", "misc"),
      })
    ),
    totalFound: s.int,
    categorySummary: s.record(s.int),
  }),
});

export default dotfileInventoryMapper;
