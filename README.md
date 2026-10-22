# Imbakan

Imbakan is a personal file library for your device. It stores uploaded files in the browser using IndexedDB so they remain available after refreshes and browser restarts without a backend.

## What this project does

- Upload images, videos, audio, archives, PDFs, documents, and more
- Show each file in a card with name, type, size, and upload date
- Download any file whenever needed
- Preview images, videos, and audio
- Search and filter files by type
- Delete files with confirmation
- Support drag-and-drop uploads
- Keep files saved locally through IndexedDB
- Use a responsive dark interface with blue and purple accents

## Local storage behavior

This version is intentionally built for local-only storage:

- Files are stored in IndexedDB in the browser on the current device.
- Files remain available after refreshing the page or reopening the website.
- No cloud authentication, database server, or secret keys are required.
- Files are not uploaded to a remote cloud backend by default.
- Browser storage limits, device available space, and private browsing settings can still affect what can be saved.

This means you get a personal digital library that works without paid services, but it is not a cloud-hosted “private vault” with user accounts or server-side access control.

## Running locally

Because this is a static site, you can run it locally in several simple ways:

### Option 1: Python web server

```bash
cd /path/to/My-Unlimited-library-
python3 -m http.server 8000
```

Then open http://localhost:8000 in your browser.

### Option 2: Any static web host

You can also serve the root folder with a static hosting tool or open the files directly in a modern browser if your browser allows local file access for IndexedDB.

## GitHub Pages deployment

This site is compatible with GitHub Pages because it is a static HTML + CSS + JavaScript project.

1. Push this repository to GitHub.
2. Open the repository on GitHub.
3. Go to Settings > Pages.
4. Select the branch to deploy from, usually `main`.
5. Choose the root folder or `/` for the site.
6. Save the settings and wait for GitHub Pages to publish the site.

Your site will be available at a URL similar to:

```text
https://<username>.github.io/<repository-name>/
```

## Notes on storage limits

- IndexedDB is limited by browser and device storage.
- Very large files may fail or be blocked depending on the browser.
- Private browsing, disk cleanup, or clearing site data will remove saved files.
- Use this for a personal library on your own device, not as a replacement for cloud backup.

## Files included

- `index.html`
- `styles.css`
- `app.js`

## License

No special license is applied; use and modify the project freely for personal local library needs.
