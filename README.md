# NoteForge

**Write · Organize · More** — an advanced notepad for Windows built with Python and PySide6.
Markdown editor with live preview, tabs, to-do list, calendar-linked notes, snippets, themes and password-protected notes.
Works fully offline; your notes stay on your computer.

![NoteForge](docs/screenshot.png)

## Features

| | |
|---|---|
| **Editor** | Line numbers, Markdown syntax highlighting, auto-continue lists, `Tab` indent, Ctrl + wheel zoom, find with highlight-all |
| **Live preview** | Headings, bold/italic/strike/underline, code blocks, quotes, tables, images, links, `[[wiki links]]` between notes, clickable task checkboxes |
| **Arabic / RTL** | Every paragraph picks its own direction automatically, in the editor and in the preview |
| **Tabs** | Many notes open at once, drag to reorder, rename by double-click, middle-click to close, session restored on start |
| **Workspace** | Folders, Recent, Starred, Trash, search, move / duplicate / export |
| **To-Do list** | Side panel with colours and progress; send any line from a note to the list (right-click) |
| **Calendar** | Link notes to dates, dots mark days that have notes, jump straight to a day's notes |
| **Snippets** | Type a shortcut and press `Tab`: `brb`, `todo`, `link`, `date`, `time` + your own (`{date}` / `{time}` placeholders) |
| **Passwords** | Lock any note — encrypted at rest with AES (Fernet, PBKDF2-SHA256, 200k iterations) |
| **Themes** | Dark, Light, Ocean, Forest, Sunset, Neon + custom accent colour |
| **Safety** | Auto-save, automatic timestamped backups (last 20 kept), automatic recovery from a corrupted data file |
| **Import / Export** | Drag `.md` / `.txt` files onto the window (UTF-8 and Windows-1256 Arabic files are detected); export notes as `.md`, `.txt` or `.html` |

## Run from source

Requires Python 3.10 or newer.

```bat
run.bat
```

or manually:

```bash
python -m venv .venv
.venv\Scripts\activate          # Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
python main.py
```

## Build a Windows `.exe`

```bat
build.bat
```

The program ends up in `dist\NoteForge\NoteForge.exe` (zip the whole `NoteForge` folder to share it).

Pushing a tag such as `v1.0.0` makes GitHub Actions build the `.exe` and attach `NoteForge-windows.zip` to a release automatically
(see `.github/workflows/build.yml`).

## Keyboard shortcuts

| Shortcut | Action | Shortcut | Action |
|---|---|---|---|
| `Ctrl+N` | New Markdown note | `Ctrl+B / I / U` | Bold / italic / underline |
| `Ctrl+Shift+N` | New text note | `Ctrl+K` | Insert link |
| `Ctrl+O` | Import files | `Ctrl+F`, `F3` | Find, next match (`Shift+F3` previous) |
| `Ctrl+S` | Save now | `Ctrl+D` | Star / unstar note |
| `Ctrl+W` | Close tab | `Ctrl+E` | Export note |
| `Ctrl+Tab` | Next tab | `Tab` | Expand snippet / indent |
| `Ctrl+Wheel` | Zoom editor text | `F11` | Full screen |

## Markdown extras

* `- [ ] task` / `- [x] done` — click the box in the editor or in the preview to toggle it.
* `[[Note name]]` — link to another note (click in the preview to open it, or create it).
* `-> centred text <-` — centre a line (toolbar button).
* `![alt](path-or-file-url)` — local images are shown in the preview.

## Where is my data?

`%APPDATA%\NoteForge\` — `data.json` (notes, folders, to-dos, settings), `backups\` and `cache\`.
Use the avatar menu → **Open data folder**. Set the `NOTEFORGE_HOME` environment variable to use another location (handy for a portable setup).

> Locked notes cannot be recovered if you forget the password.

## Project layout

```
main.py               launcher
noteforge/
  app.py              application entry point
  mainwindow.py       window, tabs, menus, wiring
  editor.py           code editor, Markdown highlighter, snippets
  mdrender.py         Markdown -> rich-text preview
  widgets.py          sidebar items, calendar, to-do, popovers, dialogs
  storage.py          JSON storage, backups, encryption
  themes.py, icons.py, assets.py
tests/                pytest suite (runs headless)
```

## Development

```bash
pip install -r requirements-dev.txt
pytest -q          # set QT_QPA_PLATFORM=offscreen on a machine without a display
```

## نبذة بالعربي

**NoteForge** برنامج ملاحظات متقدم لويندوز: محرر Markdown بمعاينة حيّة، تابات، قائمة مهام، تقويم مرتبط بالملاحظات،
اختصارات ذكية (Snippets)، قفل الملاحظات بكلمة مرور، وثيمات متعددة، مع دعم كامل للكتابة من اليمين لليسار.
شغّله بـ `run.bat` أو ابنِ ملف `.exe` بـ `build.bat`.

## License

[MIT](LICENSE)
