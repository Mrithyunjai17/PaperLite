<div align="center">
  <img src="assets/app-icon.svg" width="96" alt="PaperLite icon" />
  <h1>PaperLite</h1>
  <p>A small, private, offline PDF reader and annotator for Windows.</p>
</div>

PaperLite keeps PDF reading simple. Open a document, scroll naturally through every page, search its text, add annotations, and save a new copy. Files stay on your computer and the application does not require an internet connection.

## Features

- Continuous vertical scrolling with automatic current-page tracking
- Lazy page rendering to keep memory use low on long documents
- Fast text search across the complete PDF
- Pen, highlighter, text-note, and eraser tools
- Adjustable color, stroke width, text size, opacity, and zoom
- Undo and redo for annotation changes
- Native open and save dialogs plus PDF drag-and-drop
- Standalone Windows application with no browser window
- Original PDFs remain unchanged; annotations are written to a new copy

## Install

Download `PaperLite-Setup.exe` from the [latest release](../../releases/latest) and run it. A portable executable is included with each release for people who prefer not to install the app.

PaperLite is currently built for 64-bit Windows 10 and Windows 11. It uses the Microsoft WebView2 runtime included with current Windows installations.

## Use

1. Open PaperLite and select **Open a PDF**, or drag a PDF onto the window.
2. Scroll through the document normally with the mouse wheel, touchpad, or scrollbar.
3. Choose a tool from the left rail to draw, highlight, add text, or erase.
4. Use the bottom slider for zoom and the options menu for tool settings.
5. Select **Save a copy** to create a new annotated PDF.

Useful keyboard shortcuts:

- `Ctrl + O` opens a PDF.
- `Ctrl + F` searches the document.
- `Ctrl + S` saves an annotated copy.
- `Ctrl + Z` undoes the last annotation change.
- `Ctrl + Shift + Z` redoes the last undone change.

## Privacy and offline use

PaperLite does not include analytics, accounts, advertising, or network requests. PDF parsing, search indexing, rendering, annotations, and export all happen locally.

## Development

You will need Node.js 22 or newer, pnpm, the Rust toolchain, and the Microsoft C++ Build Tools.

```powershell
pnpm install
pnpm desktop:dev
```

Create an optimized Windows installer:

```powershell
pnpm desktop:build
```

The NSIS installer is written to `src-tauri/target/release/bundle/nsis/`.

The interface uses React and TypeScript. PDF.js handles local rendering and text extraction, pdf-lib writes annotations into exported copies, and Tauri provides the native Windows shell and file dialogs.

## Current limitations

- Find searches embedded PDF text. Image-only scans need OCR before their contents can be searched.
- Password-protected and digitally signed PDFs may have restrictions imposed by the source document.
- The current release targets Windows x64.

## Contributing

Bug reports and focused pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a change and [SECURITY.md](SECURITY.md) for private vulnerability reports.

## License

PaperLite is available under the [MIT License](LICENSE).
