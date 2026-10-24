# CharEd64

A browser editor for Commodore 64 character sets and tile screens. A project holds both ROM banks, 4096 bytes in the same order as `c64.bin`, and one screen of character codes and colors. The character map, the glyph editor, and the screen stay on the page together.

There is no build step. The page is static HTML, CSS, and ES modules. It has to be opened through a local server, because the modules and `c64.bin` do not load from a `file://` address.

```
cd chared64
make serve
```

Then open [http://127.0.0.1:8000/](http://127.0.0.1:8000/).

## Project

**From ROM** copies both 2048-byte banks out of `c64.bin`. **Blank** starts from 4096 zero bytes and a 40×25 screen of screen code 32. The project name is the export filename.

**Export JSON** writes the whole project: the name, single-color or multicolor mode, the active bank, the palette, zoom, the screen size, the 4096 character bytes, and the screen codes and colors. **Export charset** writes only those 4096 bytes as `name.bin`. **Import** replaces the open project. A file that fails to parse leaves the current project alone. Nothing is saved until you export, so closing the tab drops unsaved work.

Uppercase is bytes 0–2047. Lowercase is bytes 2048–4095. Switching banks redraws the screen with the other glyphs and leaves the screen codes where they are. Switching between single-color and multicolor reinterprets the same bytes. It does not convert them.

The [Maze 2046](../maze/README.md) title picture is a screen exported from this editor.

## Colors

The palette is the sixteen Commodore 64 colors. In single-color mode each glyph is an 8×8 grid. Bit 0 is the background and bit 1 is the ink. Each screen cell stores its own ink, from 0 to 15.

In multicolor mode each glyph is a 4×8 grid and each pixel is a bit pair, drawn twice as wide:

| Bit pair | Color |
| --- | --- |
| 00 | Background, shared, colors 0–15 |
| 01 | Multicolor 1, shared, colors 0–15 |
| 10 | Multicolor 2, shared, colors 0–15 |
| 11 | The cell's own color, colors 0–7 |

Choose a role, then a palette color. That is the pixel painted in the glyph editor. Right-click paints the background. The screen has its own cell color, shown next to the screen tools. A multicolor cell color above 7 is masked to the low three bits while that mode is on, and the stored value comes back in single-color mode.

## Editing

The character map is the 256 glyphs of the active bank, in a 16×16 grid. Clicking one selects it, opens it in the glyph editor, and arms it as the stamp for the screen.

The glyph editor paints the selected character. Copy marks that character, and Paste writes its eight bytes into the one that is open. Undo restores glyph edits.

The screen opens at 40×25. Width and height can each be set from 1 to 256. Resize keeps the top-left overlap. New cells are screen code 32. Cells that fall outside the new size are dropped, and resize itself is not undoable.

Character writes the armed glyph and the selected cell color. Color changes the cell color and leaves the glyph. Pen paints every cell the pointer crosses. Area fills the rectangle from press to release. Select marks a rectangle for cut, copy, and paste. Undo restores those cell writes.

Type places a cursor on the cell you click. Typed characters use the current cell color and the active bank. On the uppercase set both letter cases are glyphs 1–26. On the lowercase set, a–z are 1–26 and A–Z are 65–90. Space through `?` map straight across, and `@ [ £ ] ↑ ← π` map to screen codes 0, 27, 28, 29, 30, 31, and 126. Other characters are skipped. Enter continues on the next line at the column you clicked. The arrow keys, Home, and End move the cursor. Backspace and Delete clear a cell to screen code 32. Each keystroke is one undo. Ctrl+V pastes clipboard text, or a copied screen rectangle when the clipboard holds one.

## Tests

```
node --test chared64/js/model.test.js
```

Run that from the repository root. The tests use `node:test` and do not need a package install.
