# Host your Cadet Checklists on GitHub Pages

1. Extract `Cadet-Checklists-GitHub-Pages.zip`.
2. Create a GitHub repository, for example `cadet-checklists`. GitHub Free supports Pages with public repositories.
3. Upload the extracted **contents** to the repository root. `index.html` must be beside `app.js`, `storage.js`, `export.js`, `styles.css`, `catalog.json`, `pdf-lib.min.js`, and the `assets` folder. Preserve the folders and filenames. Include the empty `.nojekyll` file; if your upload omits it, create an empty file with that exact name.
4. Open **Settings → Pages**. Choose **Deploy from a branch**, select **main** and **/(root)**, then **Save**.
5. When publishing finishes, select **Visit site**. Its address normally looks like `https://YOUR-USERNAME.github.io/cadet-checklists/`. Updates can take up to 10 minutes.
6. Open that HTTPS address in Safari on your iPhone. Safari's Share menu lets you add it to your Home Screen.

No installation, build command, account connection or server is needed. All app assets use relative paths so GitHub project pages work.

## Saved progress

- Choose any of the 20 activities from the dropdown. Each checklist keeps its own answers, comments, head counts, hazards and signatures.
- Changes save automatically in this browser on this device. The green saving message confirms when they have been saved. Closing the tab or reopening the same site retains them.
- Open **Save & restore progress** for **Save now**, **Download backup**, and **Restore backup**. A backup includes every saved checklist draft in one `.json` file. On iPhone, **Share backup** can save that file to Files.
- To move from the preview site to GitHub Pages, or to another device or browser, download a backup on the original site and restore it on the destination site. Restore replaces progress only for the checklists inside that backup.
- Progress is not synced between devices. Different web addresses and browser profiles keep separate drafts. Private browsing or clearing browser data can remove drafts; keep a backup for important work.
- **Clear this checklist** clears the selected activity only. Download a backup or export its PDF first if you want to keep it.

## Completing and exporting

- Tap **Progress** on the side for completed/total counts per section. Tap a section to jump to it.
- Tap **Bottom** to reach the unfinished-section box and export controls.
- A check is complete after its answer and required comments, head counts or other details are entered. Activity details and sign-offs have their own totals.
- PDF export fills that activity's original document and keeps its original page count. No additional pages are created.
- Entered comments replace the printed guidance inside filled Comment boxes; the guidance remains visible in the app. Debrief notes go in the original Remarks box.
- If an entry cannot fit its original box, export identifies what needs shortening. Entries are not clipped or moved onto extra pages.
- A PDF is marked **DRAFT** while entries remain unfinished. Review the form and sign-offs before using it.
- On iPhone, use **Share PDF**, or **Open PDF** and the viewer's Share button, to save the completed PDF to Files.

Answers and signatures are stored and processed in your browser. The app does not upload them. The usual GitHub Pages site and its blank PDF templates are publicly accessible, so publish only templates you intend to make available.

## Official GitHub instructions

- [Create a GitHub Pages site](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)
- [Configure the publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [GitHub Pages availability and project addresses](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)

The bundled PDF library's license is included as `PDF-LIB-LICENSE.md`.
