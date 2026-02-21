[日本語](README.md)

# DiTiS - Digital Timesheet

<p align="center">
  <img src="icon.png" alt="DiTiS" width="96">
</p>

Digital Timesheet for Anime Production

## Overview

DiTiS is a desktop application that digitizes the timesheets used in anime production. Built with the Tauri 2.x framework, it features integration with After Effects.

## Features

- **Spreadsheet-style timesheet** - Numpad, WASD, and other input schemes optimized for anime production
- **After Effects integration** - Send/receive time remapping, ExtendScript export
- **Multiple file format support** - JSON / STS / XDTS / TDTS
- **3 themes** - Light / Dark / Green
- **Multilingual** - Japanese / English
- **5 display sizes** - Extra Small / Small / Standard / Large / Extra Large
- **500-level Undo/Redo**
- **Auto-update** - Via GitHub Releases (can be toggled on/off)
- **Multi-sheet** - Manage multiple sheets with tabs (drag & drop reordering)
- **Cross-platform** - Windows / macOS / Linux

## Installation

Download the latest installer from the [Releases](https://github.com/MisakiAkatsuki/ditis/releases) page.

---

## Keyboard Shortcuts

### File Operations

| Shortcut | Action |
|---|---|
| `Ctrl+N` | Create new sheet |
| `Ctrl+O` | Open file |
| `Ctrl+S` | Save (save dialog on first save, overwrite thereafter) |
| `Ctrl+Shift+S` | Save as |
| `Ctrl+W` | Close current sheet |

### After Effects

| Shortcut | Action |
|---|---|
| `Ctrl+E` | Send to After Effects (time remap) |
| `Ctrl+I` | Get time remap from AE |
| `Ctrl+Shift+E` | Export as ExtendScript (.jsx) |

### Editing

| Shortcut | Action |
|---|---|
| `Ctrl+Z` | Undo (up to 500 levels) |
| `Ctrl+Y` | Redo |
| `Ctrl+C` | Copy |
| `Ctrl+X` | Cut |
| `Ctrl+V` | Paste |
| `Ctrl+A` | Select all |
| `Delete` | Delete selected cells |

### Navigation

| Shortcut | Action |
|---|---|
| `Arrow keys` | Move cell |
| `Shift+Arrow keys` | Extend selection |
| `Home` | Go to first frame |
| `End` | Go to last entered position |
| `Shift+Home` | Select to beginning |
| `Shift+End` | Select to last entered position |
| `Escape` | Collapse selection to top-left / move to A1 |
| `Ctrl+Enter` | Move to the top of the next column (cyclic) |
| `1-9, 0` | Select the first frame of a column (1=column A, 0=10th column) |

### Input & Operations

| Shortcut | Action |
|---|---|
| `F2` | Start editing cell |
| `Numpad 0-9` | Start entering a number in the cell |
| `Enter` | Confirm input & move down (auto-copies previous cell value) |
| `+` | Enter previous cell value +1 and move down |
| `-` | Enter previous cell value −1 and move down |
| `.` (period) | Fill to end with "-" / move down |
| `*` | Extend selection down by 1 frame |
| `/` | Shrink selection from bottom by 1 frame |
| `Space` | Move down one row while keeping selection |

### Temporary Selection Extension (active only while key is held)

| Key | Action |
|---|---|
| `W` | Shrink selection from bottom |
| `S` | Extend selection downward |
| `A` | Shrink selection from right |
| `D` | Extend selection to the right |

### Other

| Shortcut | Action |
|---|---|
| `F1` | Show/hide help dialog |
| `Ctrl+Shift+R` | Reload page |

---

## Menu Structure

### File

| Menu Item | Description |
|---|---|
| New (Ctrl+N) | Create a new sheet |
| Open (Ctrl+O) | Open a file (JSON/STS/XDTS/TDTS) |
| Save (Ctrl+S) | Overwrite save to current file |
| Save As (Ctrl+Shift+S) | Save under a different name |
| Export as ExtendScript (Ctrl+Shift+E) | Export as a .jsx file |
| Close (Ctrl+W) | Close the current sheet |
| Close All Sheets | Close all sheets |
| Quit | Exit the application |

### Edit

| Menu Item | Description |
|---|---|
| Undo (Ctrl+Z) | Undo the last action (up to 500 levels) |
| Redo (Ctrl+Y) | Redo the undone action |

### Sheet

| Menu Item | Description |
|---|---|
| Sheet Settings | Configure sheet name, FPS, and duration at once |
| Show Dialog on New Sheet | Show settings dialog when creating a new sheet |
| Change Duration | Change the total number of frames |
| Change Frame Rate | Change FPS (24/30, etc.) |
| Change Frames per Sheet | Number of frames per page break |
| Change Column Count | Change the number of columns displayed |
| Reset Column Names | Reset all column names to A, B, C... |
| Send to After Effects (Ctrl+E) | Send time remap to AE |
| Get Time Remap from AE | Load time remap from AE |
| Reset Sheet | Clear all sheet data |

### View

| Menu Item | Description |
|---|---|
| **Frame Display** | |
| Show All Frames | Display all frames |
| Odd Frames Only | Display odd-numbered frames only |
| Even Frames Only | Display even-numbered frames only |
| **Header Notation** | |
| Timesheet Notation | Detailed seconds+frames notation (e.g., 1 sec 12 frames) |
| Sequential Number | Sequential numbering (e.g., 36) |
| **Display Size** | |
| Extra Small / Small / Standard / Large / Extra Large | 5 levels of cell size |
| Show Frame Header Between Columns | Display frame numbers between columns |
| Reset Display Settings | Restore all display settings to default |
| **Theme** | |
| Light / Dark / Green | Switch color theme |
| **Language** | |
| Japanese / English | Switch UI language |
| Always on Top | Keep window always on top |
| Center Scroll on Selection | Auto-scroll when selecting cells |
| Reload Page | Redraw the screen |

### Help

| Menu Item | Description |
|---|---|
| Check for Updates | Manually check for updates |
| Check on Startup | Automatically check for updates on launch (once per day) |
| Help (F1) | Shortcut list |
| About | Version information |

---

## Context Menu

### Cell Right-Click

| Menu Item | Description |
|---|---|
| Loop | Repeat the pattern of the selection to the end (shown only when multiple cells are selected) |
| Delete Cell Contents | Clear values in selected cells |
| Copy / Cut / Paste | Clipboard operations |

### Row Header Right-Click

| Menu Item | Description |
|---|---|
| Insert Row | Insert a frame at the selected position |
| Delete Row | Delete the selected frame |
| Disable/Enable Row | Disable a frame (exclude from duration calculation) |
| Shift Frames | Shift data downward from the selected position |
| Copy / Cut / Paste Row Values | Row-level clipboard operations |

### Column Header Right-Click

| Menu Item | Description |
|---|---|
| Insert Column | Insert a column at the selected position |
| Rename Layer | Rename the column |
| Swap with Left/Right Column | Swap column order |
| Delete Column | Delete the selected column |
| Delete This Column and All to the Right | Delete everything to the right of the selected column |
| Delete Cell Contents | Clear all values in the column |
| Copy / Cut / Paste Column Values | Column-level clipboard operations |

---

## Supported File Formats

| Format | Extension | Read | Write | Description |
|---|---|---|---|---|
| DiTiS JSON | `.json` | Y | Y | DiTiS native format (preserves all data) |
| STS | `.sts` | Y | Y | Legacy timesheet format |
| XDTS | `.xdts` | Y | Y | OpenToonz-compatible format |
| TDTS | `.tdts` | Y | Y | Toei Digital Timesheet format |

---

## After Effects Integration

### Direct Send (`Ctrl+E`)
Sends timesheet data to the active composition in AE.

- After Effects must be running (**Windows only**)
- If multiple AE instances exist, the foreground one is used
- When no layer is selected, applies automatically to all AVLayers (excluding cameras and lights)
- Automatically converts full-width alphabetic layer names to half-width for matching
- Displays a warning if there is an FPS mismatch
- Restores layer selection state after execution

### Send Options
- **Empty cell handling**: Blind effect / Time remap
- **Add markers**: Add time remap values as layer markers
- **Auto pre-compose**: Automatically pre-compose non-composition layers

### Get Time Remap (`Ctrl+I`)
Loads the time remap from the active layer in AE.

### ExtendScript Export (`Ctrl+Shift+E`)
Exports as a .jsx file that can be run manually from the AE Scripts panel.

---

## Timesheet Symbols

| Symbol | Meaning |
|---|---|
| Number | Frame number (cel number) |
| `-` (dash) | The same value continues from the previous cell (displayed automatically) |
| `│` (vertical bar) | The same value continues to the end of the duration |
| `×` (cross) | Single-cel shot (only one cell) |
| `~` (tilde) | Two-cel shot |

---

## License

See [LICENSE](LICENSE).

## Author

Misaki Akatsuki / SUNRISE MOON

---

[日本語版 README](README.md)
