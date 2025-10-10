# Repository Guidelines

## Project Structure & Module Organization
The static site lives under docs/, with HTML entry points (index.html, knowledge.html, notes.html, vocab.html) sharing common assets.
Page data sits in docs/config.js, while page scripts live in docs/assets/js.
Author Sass in docs/assets/scss and treat docs/assets/css as generated output.
Store shared imagery in docs/images/.

## Build, Test, and Development Commands
- "npm install" prepares the Sass toolchain defined in package.json.
- "npm run dev" builds Sass once, then watches docs/assets/scss so CSS stays current during local edits.
- "npm run build" outputs compressed CSS for release; run it before committing style or layout changes.

## Coding Style & Naming Conventions
Match the existing two-space indentation across HTML, Sass, and JavaScript.
Favor descriptive camelCase for variables and functions (buildGrid, equalizeHeights) and kebab-case for CSS classes (card-text, card-img).
Keep Sass partials prefixed with an underscore (for example _colors.scss) and import them at the top of page-level files.
Maintain semantic headings and data attributes relied upon by the grid scripts.

## Testing Guidelines
We rely on manual verification.
After updating content or scripts, run "npm run dev", open the affected pages from docs/ in a browser, check the console, and resize to confirm responsive behavior.
For JavaScript changes, ensure the grid renders correctly with the data in config.js and that card heights remain consistent.

## Commit & Pull Request Guidelines
Existing commits use short, imperative summaries such as Sync docs/assets/css/index.css; mirror that style and include source changes whenever compiled assets are touched.
Each pull request should provide a concise description, links to any tracked issues, and screenshots or screen recordings for UI tweaks.
Note the commands and manual checks you executed so reviewers can follow the same steps quickly.

## Content & Data Updates
When adding tiles or copy, edit docs/config.js and place new images in docs/images/ with meaningful filenames.
Preserve the fallback assets (DEV.png, "null") unless you also adjust the rendering logic, and verify fonts handle any new language characters.
