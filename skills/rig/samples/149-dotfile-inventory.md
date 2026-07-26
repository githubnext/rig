# 149 - Dotfile Inventory

```rig
import { agent, p, s, repair } from "rig";

// Agent role: Discover and categorize dotfiles in the workspace root and nearby directories.
const dotfileInventory = agent({
  model: "small",
  instructions: p`Inventory all dotfiles in the workspace and categorize them.

Find dotfiles:
${p.bash("find . -maxdepth 2 -name '.*' -type f ! -path '*/.git/*' 2>/dev/null")}

Read common dotfiles for context:
${p.bash("find . -maxdepth 2 -name '.*' -type f ! -path '*/.git/*' 2>/dev/null | head -10 | xargs head -c 200 2>/dev/null")}

For each dotfile, determine its purpose and category:
- editor: .editorconfig, .vscode/*, .nvmrc
- git: .gitignore, .gitattributes, .gitmodules
- shell: .bashrc, .zshrc, .profile, .env
- package: .npmrc, .yarnrc, .nvmrc, .node-version
- ci: .travis.yml, .circleci, .github, .eslintrc
- other: anything else

Return dotfiles record (keyed by filename) with purpose and category, totalFound, and categorySummary (record of counts per category).`,
  addons: repair(),
  output: s.object({
    dotfiles: s.record(
      s.object({
        purpose: s.string,
        category: s.enum("editor", "git", "shell", "package", "ci", "other"),
      }),
    ),
    totalFound: s.int,
    categorySummary: s.record(s.int),
  }),
});

export default dotfileInventory;
```
