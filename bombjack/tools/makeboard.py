#!/usr/bin/env python3
"""Build the first Bomb Jack board as a C64 multicolor bitmap.

The layout is measured from the round-1 still: sphinx on the right, pyramid
on the left, five platforms, and the bombs that are actually on that screen.
Graphics are drawn for the C64, not taken from the arcade ROMs. The script
writes src/board.s, src/hud.inc and preview.png.
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

# C64 colours. Background is blue, so a cell may use blue plus three others,
# and only one of those three may be in the upper eight colours... any colour
# can sit in the two screen-RAM nibbles, but colour RAM is 0-7 only.
BLACK, WHITE, RED, CYAN, PURPLE, GREEN, BLUE, YELLOW = range(8)
ORANGE, BROWN, LTRED, GRAY1, GRAY2, LTGREEN, LTBLUE, GRAY3 = range(8, 16)

PEPTO = [
    (0, 0, 0), (255, 255, 255), (104, 55, 43), (112, 164, 178),
    (111, 61, 134), (88, 141, 67), (53, 40, 121), (184, 199, 111),
    (111, 79, 37), (67, 57, 0), (154, 103, 89), (68, 68, 68),
    (108, 108, 108), (154, 210, 132), (108, 94, 181), (149, 149, 149),
]

DIST = [[0] * 16 for _ in range(16)]
for _a in range(16):
    for _b in range(16):
        dr = PEPTO[_a][0] - PEPTO[_b][0]
        dg = PEPTO[_a][1] - PEPTO[_b][1]
        db = PEPTO[_a][2] - PEPTO[_b][2]
        DIST[_a][_b] = dr * dr + dg * dg + db * db

# Hardware pixels. Rows 0-1 are the top score bar, row 2 and column 0/39
# and row 23 are the frame, rows 3-22 are the playfield, row 24 is the
# bottom bar.
W, H = 320, 200
PLAY_X0, PLAY_Y0 = 8, 24
PLAY_X1, PLAY_Y1 = 312, 184
SAND_Y = 168
BOMB_R = 5
BOMB_FUSE = 3
BOMB_CELLS = 4

# Glyph ink is bit-pair 01 (screen high nibble = yellow). Paper is bit-pair
# 11 (colour RAM = black). The green badge uses bit-pair 11 on bit-pair 10.
GLYPH_INK, GLYPH_PAPER = 1, 3
GREEN_INK, GREEN_PAPER = 3, 2

INNER_X0, INNER_Y0 = 8, 24
INNER_W, INNER_H = 303, 159

# Image area inside the golden frame of the reference still (512x660).
IMG_X0, IMG_Y0 = 50, 62
IMG_W, IMG_H = 420, 532


def px(ix):
    return INNER_X0 + int(round((ix - IMG_X0) * INNER_W / float(IMG_W)))


def py(iy):
    return INNER_Y0 + int(round((iy - IMG_Y0) * INNER_H / float(IMG_H)))


def ip(ix, iy):
    return px(ix), py(iy)


pix = [BLUE] * (W * H)


def plot(x, y, c):
    if 0 <= x < W and 16 <= y < 192:
        pix[y * W + x] = c


def get(x, y):
    if 0 <= x < W and 0 <= y < H:
        return pix[y * W + x]
    return BLUE


def hline(x0, x1, y, c):
    if x0 > x1:
        x0, x1 = x1, x0
    for x in range(x0, x1 + 1):
        plot(x, y, c)


def disc(cx, cy, r, c):
    rr = r * r
    for y in range(cy - r, cy + r + 1):
        for x in range(cx - r, cx + r + 1):
            dx = x - cx
            dy = y - cy
            if dx * dx + dy * dy <= rr:
                plot(x, y, c)


def fill_poly(pts, c):
    if len(pts) < 3:
        return
    ys = [p[1] for p in pts]
    y0 = max(16, min(ys))
    y1 = min(191, max(ys))
    for y in range(y0, y1 + 1):
        xs = []
        for i in range(len(pts)):
            x_a, y_a = pts[i]
            x_b, y_b = pts[(i + 1) % len(pts)]
            if (y_a <= y < y_b) or (y_b <= y < y_a):
                t = (y - y_a) / float(y_b - y_a)
                xs.append(x_a + t * (x_b - x_a))
        xs.sort()
        for i in range(0, len(xs) - 1, 2):
            hline(int(round(xs[i])), int(round(xs[i + 1])), y, c)


def draw_sand():
    for y in range(SAND_Y, 184):
        band = (y // 2) & 1
        for x in range(8, 312):
            # Two colours only, so a bomb cell on the sand still fits.
            if band == 0 or ((x + y) & 7) == 0:
                plot(x, y, YELLOW)
            else:
                plot(x, y, BROWN)


def draw_pyramid(apex, left, right):
    pts = [apex, right, (right[0], SAND_Y - 1), (left[0], SAND_Y - 1), left]
    ys = [p[1] for p in pts]
    for y in range(max(16, min(ys)), min(191, max(ys) + 1)):
        xs = []
        for i in range(len(pts)):
            x_a, y_a = pts[i]
            x_b, y_b = pts[(i + 1) % len(pts)]
            if (y_a <= y < y_b) or (y_b <= y < y_a):
                t = (y - y_a) / float(y_b - y_a)
                xs.append(x_a + t * (x_b - x_a))
        if len(xs) < 2:
            continue
        xs.sort()
        x_l = int(round(xs[0]))
        x_r = int(round(xs[-1]))
        mortar = (y - apex[1]) % 6 == 0 and (x_r - x_l) > 14
        split = x_l + (x_r - x_l) * 2 // 3
        for x in range(x_l, x_r + 1):
            if mortar:
                plot(x, y, BLACK)
            elif x < split:
                plot(x, y, ORANGE)
            else:
                plot(x, y, BROWN)


def draw_sphinx():
    """Grey reclining sphinx so it stays distinct from the orange pyramid."""
    ex, ey = ip(350, 410)
    # Body, haunch to the right, chest rising toward the head.
    fill_poly([
        (ex - 28, ey - 18),
        (ex + 58, ey - 14),
        (ex + 76, ey + 16),
        (ex + 28, ey + 36),
        (ex - 30, ey + 32),
        (ex - 46, ey + 8),
    ], GRAY2)
    fill_poly([
        (ex - 16, ey + 14),
        (ex + 60, ey + 8),
        (ex + 66, ey + 26),
        (ex + 20, ey + 40),
        (ex - 30, ey + 34),
    ], GRAY2)
    # Outstretched paw.
    fill_poly([
        (ex - 62, ey + 16),
        (ex - 22, ey + 10),
        (ex - 18, ey + 28),
        (ex - 60, ey + 32),
    ], GRAY2)
    hline(ex - 56, ex - 24, ey + 26, BLACK)
    # Head sitting on the shoulders, facing left.
    hx, hy = ex - 18, ey - 16
    disc(hx, hy, 16, BLACK)
    disc(hx, hy, 13, GRAY3)
    disc(hx + 5, hy + 1, 9, GRAY2)
    disc(hx - 2, hy - 1, 9, GRAY3)
    # Nemes headdress and its stripes.
    fill_poly([
        (hx - 18, hy - 4),
        (hx - 4, hy - 24),
        (hx + 32, hy - 16),
        (hx + 24, hy + 4),
        (hx - 14, hy + 6),
    ], GRAY3)
    for dy in (-16, -10, -4):
        hline(hx - 6, hx + 26, hy + dy, BLACK)
    # Lappet beside the cheek.
    fill_poly([
        (hx - 16, hy + 2),
        (hx - 6, hy + 6),
        (hx - 10, hy + 26),
        (hx - 20, hy + 22),
    ], GRAY2)
    hline(hx - 18, hx - 8, hy + 12, BLACK)
    hline(hx - 18, hx - 8, hy + 18, BLACK)
    # Eye, brow and a nose that points left.
    hline(hx - 12, hx + 4, hy - 2, BLACK)
    hline(hx - 13, hx + 5, hy - 1, BLACK)
    hline(hx - 12, hx + 3, hy, BLACK)
    hline(hx - 11, hx + 2, hy + 1, BLACK)
    fill_poly([
        (hx - 20, hy + 4),
        (hx - 8, hy + 1),
        (hx - 7, hy + 9),
    ], GRAY2)
    hline(hx - 10, hx + 2, hy + 7, BLACK)
    fill_poly([
        (hx - 3, hy + 9),
        (hx + 3, hy + 9),
        (hx + 2, hy + 20),
        (hx - 2, hy + 20),
    ], GRAY2)


def soften_sand_under_ink():
    """Sphinx cells may only contain the two greys, black and sky."""
    allowed = (BLUE, GRAY3, GRAY2, BLACK)
    for row in range(3, 23):
        for col in range(1, 39):
            base = row * 8 * W + col * 8
            sphinx = False
            for yy in range(8):
                for xx in range(8):
                    if pix[base + yy * W + xx] in (GRAY3, GRAY2):
                        sphinx = True
                        break
                if sphinx:
                    break
            if not sphinx:
                continue
            for yy in range(8):
                for xx in range(8):
                    i = base + yy * W + xx
                    if pix[i] not in allowed:
                        pix[i] = GRAY2


def snap_platform(x0, x1, y):
    row = int(round(y / 8.0))
    y = row * 8
    if y < 24:
        y = 24
    if y > 176:
        y = 176
    x0 = (x0 // 8) * 8
    x1 = ((x1 // 8) + 1) * 8 - 1
    if x0 < 8:
        x0 = 8
    if x1 > 311:
        x1 = 311
    if x1 < x0 + 15:
        x1 = min(311, x0 + 15)
    return x0, x1, y


def draw_platform(x0, x1, y):
    for i in range(8):
        if i < 2:
            c = YELLOW
        elif i < 6:
            c = ORANGE
        else:
            c = RED
        hline(x0, x1, y + i, c)


def platform_cells(x0, x1, y):
    cells = []
    col0 = x0 // 8
    col1 = x1 // 8
    row = y // 8
    for col in range(col0, col1 + 1):
        cells.append((col, row))
    return cells


def draw_frame():
    def color_at(x, y):
        d = min(x, 319 - x, y - 16, 191 - y)
        if d <= 2:
            return YELLOW
        if d <= 6:
            return ORANGE
        return BLACK

    for y in range(16, 192):
        for x in range(0, 8):
            pix[y * W + x] = color_at(x, y)
        for x in range(312, 320):
            pix[y * W + x] = color_at(x, y)
    for y in range(16, 24):
        for x in range(8, 312):
            pix[y * W + x] = color_at(x, y)
    for y in range(184, 192):
        for x in range(8, 312):
            pix[y * W + x] = color_at(x, y)


def bomb_box(cx, cy):
    return (cx - BOMB_R, cy - BOMB_R - BOMB_FUSE, cx + BOMB_R, cy + BOMB_R)


def bomb_cells(cx, cy):
    x0, y0, x1, y1 = bomb_box(cx, cy)
    cols = range(x0 // 8, x1 // 8 + 1)
    rows = range(y0 // 8, y1 // 8 + 1)
    return [(c, r) for r in rows for c in cols]


def cells_ok(cells, taken):
    if len(cells) > BOMB_CELLS or not cells:
        return False
    cols = [c for c, _r in cells]
    rows = [r for _c, r in cells]
    if max(cols) - min(cols) > 1 or max(rows) - min(rows) > 1:
        return False
    for c in cells:
        col, row = c
        if col < 1 or col > 38 or row < 3 or row > 22:
            return False
        if c in taken:
            return False
    return True


def place_bomb(cx, cy, taken):
    for dist in range(16):
        for dy in range(-dist, dist + 1):
            for dx in range(-dist, dist + 1):
                if max(abs(dx), abs(dy)) != dist:
                    continue
                cells = bomb_cells(cx + dx, cy + dy)
                if cells_ok(cells, taken):
                    return cx + dx, cy + dy, cells
    raise SystemExit("no room for a bomb at %d,%d" % (cx, cy))


def draw_bomb(cx, cy):
    disc(cx, cy, BOMB_R, LTRED)
    plot(cx - 2, cy - 2, YELLOW)
    plot(cx - 1, cy - 2, YELLOW)
    plot(cx - 2, cy - 1, YELLOW)
    plot(cx, cy - BOMB_R - 1, YELLOW)
    plot(cx, cy - BOMB_R - 2, YELLOW)
    plot(cx + 1, cy - BOMB_R - 2, YELLOW)
    plot(cx + 1, cy - BOMB_R - 3, YELLOW)


def sanitize_bomb(cx, cy):
    """Keep each bomb cell inside blue + light red + yellow + brown."""
    keep = (BLUE, LTRED, YELLOW, BROWN)
    for col, row in bomb_cells(cx, cy):
        for yy in range(8):
            for xx in range(8):
                x = col * 8 + xx
                y = row * 8 + yy
                c = pix[y * W + x]
                if c not in keep:
                    pix[y * W + x] = BROWN if c == ORANGE else BLUE


def pack(src):
    bitmap = bytearray(8000)
    screen = bytearray(1000)
    color = bytearray(1000)
    for row in range(25):
        for col in range(40):
            colors = []
            for yy in range(8):
                for xx in range(4):
                    x = col * 8 + xx * 2
                    y = row * 8 + yy
                    c0 = src[y * W + x]
                    c1 = src[y * W + x + 1]
                    if c0 == c1:
                        colors.append(c0)
                    elif c0 == BLACK or c1 == BLACK:
                        colors.append(BLACK)
                    elif c0 == BLUE:
                        colors.append(c1)
                    else:
                        colors.append(c0)
            present = []
            for c in colors:
                if c not in present:
                    present.append(c)
            hi = list(present)
            if BLUE not in hi:
                hi.append(BLUE)
            lo = [c for c in hi if c <= 7] or [0]
            best = None
            best_err = 1 << 30
            for c01 in hi:
                for c10 in hi:
                    for c11 in lo:
                        slots = (BLUE, c01, c10, c11)
                        inv = {}
                        for pi, colr in enumerate(slots):
                            if colr not in inv:
                                inv[colr] = pi
                        err = 0
                        pairs = []
                        for c in colors:
                            if c in inv:
                                pairs.append(inv[c])
                            else:
                                pick = 0
                                bestd = 1 << 30
                                for colr, pi in inv.items():
                                    d = DIST[c][colr]
                                    if d < bestd:
                                        bestd = d
                                        pick = pi
                                err += bestd
                                pairs.append(pick)
                        if err < best_err:
                            best_err = err
                            best = (c01 & 15, c10 & 15, c11 & 7, pairs)
                        if err == 0:
                            break
                    if best_err == 0:
                        break
                if best_err == 0:
                    break
            c01, c10, c11, pairs = best
            base = (row * 40 + col) * 8
            for yy in range(8):
                b = 0
                for xx in range(4):
                    b = (b << 2) | pairs[yy * 4 + xx]
                bitmap[base + yy] = b
            screen[row * 40 + col] = (c01 << 4) | c10
            color[row * 40 + col] = c11
    return bitmap, screen, color


# 3x5 glyphs, '#' is ink. ASCII 32..90, anything missing is blank.
RAW = {
    " ": ["...", "...", "...", "...", "..."],
    "-": ["...", "...", "###", "...", "..."],
    "0": ["###", "#.#", "#.#", "#.#", "###"],
    "1": [".#.", "##.", ".#.", ".#.", "###"],
    "2": ["###", "..#", "###", "#..", "###"],
    "3": ["###", "..#", "###", "..#", "###"],
    "4": ["#.#", "#.#", "###", "..#", "..#"],
    "5": ["###", "#..", "###", "..#", "###"],
    "6": ["###", "#..", "###", "#.#", "###"],
    "7": ["###", "..#", "..#", "..#", "..#"],
    "8": ["###", "#.#", "###", "#.#", "###"],
    "9": ["###", "#.#", "###", "..#", "###"],
    "A": [".#.", "#.#", "###", "#.#", "#.#"],
    "B": ["##.", "#.#", "##.", "#.#", "##."],
    "C": [".##", "#..", "#..", "#..", ".##"],
    "D": ["##.", "#.#", "#.#", "#.#", "##."],
    "E": ["###", "#..", "##.", "#..", "###"],
    "F": ["###", "#..", "##.", "#..", "#.."],
    "G": [".##", "#..", "#.#", "#.#", ".##"],
    "H": ["#.#", "#.#", "###", "#.#", "#.#"],
    "I": ["###", ".#.", ".#.", ".#.", "###"],
    "J": ["..#", "..#", "..#", "#.#", ".#."],
    "K": ["#.#", "#.#", "##.", "#.#", "#.#"],
    "L": ["#..", "#..", "#..", "#..", "###"],
    "M": ["#.#", "###", "#.#", "#.#", "#.#"],
    "N": ["##.", "#.#", "#.#", "#.#", "#.#"],
    "O": [".#.", "#.#", "#.#", "#.#", ".#."],
    "P": ["##.", "#.#", "##.", "#..", "#.."],
    "Q": [".#.", "#.#", "#.#", ".#.", "..#"],
    "R": ["##.", "#.#", "##.", "#.#", "#.#"],
    "S": [".##", "#..", ".#.", "..#", "##."],
    "T": ["###", ".#.", ".#.", ".#.", ".#."],
    "U": ["#.#", "#.#", "#.#", "#.#", ".##"],
    "V": ["#.#", "#.#", "#.#", ".#.", ".#."],
    "W": ["#.#", "#.#", "#.#", "###", "#.#"],
    "X": ["#.#", "#.#", ".#.", "#.#", "#.#"],
    "Y": ["#.#", "#.#", ".#.", ".#.", ".#."],
    "Z": ["###", "..#", ".#.", "#..", "###"],
}


def glyph_rows(ch):
    return RAW.get(ch, RAW[" "])


def glyph_bits(ch):
    out = []
    for row in glyph_rows(ch):
        b = 0
        for i, bit in enumerate(row[:3]):
            if bit == "#":
                b |= 1 << (2 - i)
        out.append(b)
    return out


def encode_row(bits, ink, paper):
    b = 0
    for i in range(3):
        b = (b << 2) | (ink if (bits & (4 >> i)) else paper)
    return (b << 2) | paper


def set_text_cell(bm, sc, co, col, row):
    off = row * 40 + col
    sc[off] = 0x70
    co[off] = 0
    base = off * 8
    for i in range(8):
        bm[base + i] = 0xFF


def set_yellow_cell(bm, sc, co, col, row):
    off = row * 40 + col
    sc[off] = 0x70
    co[off] = 0
    base = off * 8
    for i in range(8):
        bm[base + i] = 0x55


def set_green_cell(bm, sc, co, col, row):
    off = row * 40 + col
    sc[off] = 0x75
    co[off] = 0
    base = off * 8
    bm[base] = 0x55
    for i in range(1, 6):
        bm[base + i] = 0xAA
    bm[base + 6] = 0x55
    bm[base + 7] = 0x55


def stamp(bm, col, row, ch, ink, paper):
    bits = glyph_bits(ch)
    base = (row * 40 + col) * 8
    for i in range(5):
        bm[base + 1 + i] = encode_row(bits[i], ink, paper)


def write_text(bm, col, row, text):
    for i, ch in enumerate(text):
        stamp(bm, col + i, row, ch, GLYPH_INK, GLYPH_PAPER)


def apply_hud(bm, sc, co):
    for row in (0, 1, 24):
        for col in range(40):
            set_text_cell(bm, sc, co, col, row)
    write_text(bm, 1, 0, "SIDE-ONE")
    write_text(bm, 1, 1, "000000")
    write_text(bm, 11, 24, "ROUND 1")
    write_text(bm, 22, 24, "HI-SCORE")
    write_text(bm, 31, 24, " 10000")
    set_yellow_cell(bm, sc, co, 30, 0)
    set_yellow_cell(bm, sc, co, 34, 0)
    for col in (31, 32, 33):
        set_green_cell(bm, sc, co, col, 0)
    stamp(bm, 31, 0, "X", GREEN_INK, GREEN_PAPER)
    stamp(bm, 32, 0, " ", GREEN_INK, GREEN_PAPER)
    stamp(bm, 33, 0, "1", GREEN_INK, GREEN_PAPER)


JACK_A = [
    "..BBBB..",
    ".BBBBBB.",
    ".BBBBBB.",
    "WWW.RRR.",
    "WWRRRRR.",
    ".WRRRRRR",
    "..RRRRRR",
    "..RRRRR.",
    "...RRRR.",
    "...R..R.",
    "...R..R.",
    "..RR.RR.",
    "..RR.RR.",
    "........",
]
JACK_B = [
    ".WW.....",
    "WWBBBB..",
    ".BBBBBB.",
    "WWW.RRR.",
    "WWRRRRR.",
    ".WRRRRRR",
    "..RRRRRR",
    "..RRRRR.",
    "...RRRR.",
    "...R..R.",
    "...R..R.",
    "..RR.RR.",
    "..RR.RR.",
    "........",
]
EN_A = [
    "....####....",
    "..########..",
    ".###.##.###.",
    ".##########.",
    "..########..",
    "...######...",
    "..########..",
    ".##########.",
    ".###....###.",
    ".##......##.",
    "..##....##..",
    "..##....##..",
    "...##..##...",
    "....####....",
    "............",
]
EN_B = [
    "....####....",
    "..########..",
    ".###.##.###.",
    ".##########.",
    "..########..",
    "...######...",
    "..########..",
    ".##########.",
    ".###....###.",
    ".##......##.",
    "...##....##.",
    "..##....##..",
    "..##..##....",
    "...####.....",
    "............",
]
LIFE = [
    ".BB...",
    "BBB...",
    "WRRR..",
    ".RRRR.",
    ".RRRR.",
    ".R..R.",
    "RR..RR",
    "......",
]

MC = {".": 0, "W": 1, "R": 2, "B": 3}


def encode_mc(rows):
    padded = [r.ljust(12, ".")[:12] for r in rows]
    while len(padded) < 21:
        padded.append("." * 12)
    out = []
    for r in padded:
        vals = [MC[ch] for ch in r]
        for i in range(0, 12, 4):
            out.append((vals[i] << 6) | (vals[i + 1] << 4) | (vals[i + 2] << 2) | vals[i + 3])
    out.append(0)
    if len(out) != 64:
        raise SystemExit("sprite is %d bytes" % len(out))
    return out


def encode_hi(rows):
    padded = [r.ljust(24, ".")[:24] for r in rows]
    while len(padded) < 21:
        padded.append("." * 24)
    out = []
    for r in padded:
        for i in range(0, 24, 8):
            b = 0
            for bit in range(8):
                if r[i + bit] == "#":
                    b |= 1 << (7 - bit)
            out.append(b)
    out.append(0)
    if len(out) != 64:
        raise SystemExit("sprite is %d bytes" % len(out))
    return out


def used_size(rows, mult):
    """Width and height of the drawn pixels, in hardware pixels."""
    w = 0
    h = 0
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch not in (".",):
                if (x + 1) * mult > w:
                    w = (x + 1) * mult
                h = y + 1
    return w, h


def emit_bytes(f, data):
    for i in range(0, len(data), 16):
        chunk = data[i:i + 16]
        f.write("        .byte %s\n" % ",".join("%d" % b for b in chunk))


def emit_words(f, words):
    f.write("        .word %s\n" % ",".join("%d" % w for w in words))


def main():
    draw_sand()
    plats = []
    for name, x0, x1, y in (
        ("upper", 276, 388, 166),
        ("pyramid", 129, 192, 232),
        ("mid", 226, 323, 412),
        ("lowleft", 80, 144, 480),
        ("lowright", 294, 435, 536),
    ):
        sx0, sx1, sy = snap_platform(px(x0), px(x1), py(y))
        plats.append((name, sx0, sx1, sy))
    by_name = dict((p[0], p) for p in plats)
    apex_x = px(168)
    apex = (apex_x, by_name["pyramid"][3] + 4)
    draw_pyramid(apex, (px(55), py(430)), (px(300), py(450)))
    draw_sphinx()
    soften_sand_under_ink()
    for _name, x0, x1, y in plats:
        draw_platform(x0, x1, y)

    taken = set()
    for _name, x0, x1, y in plats:
        for c in platform_cells(x0, x1, y):
            taken.add(c)

    # Lit-bomb order starts under the ledge Jack stands on.
    image_bombs = [
        (304, 211), (353, 211), (402, 211),
        (108, 88), (157, 88), (353, 88), (402, 88), (451, 88),
        (451, 272), (451, 334), (451, 395), (451, 457),
        (304, 518), (353, 518), (402, 518),
        (108, 579), (157, 579), (206, 579),
        (60, 457), (60, 395), (60, 334), (60, 272),
    ]
    bombs = []
    for ix, iy in image_bombs:
        cx, cy, cells = place_bomb(px(ix), py(iy), taken)
        for c in cells:
            taken.add(c)
        bombs.append((cx, cy, cells))

    background = pix[:]
    for cx, cy, _cells in bombs:
        draw_bomb(cx, cy)
        sanitize_bomb(cx, cy)
    draw_frame()
    # The frame is part of both pictures, so it is not "under" a bomb.
    for y in range(16, 192):
        for x in list(range(0, 8)) + list(range(312, 320)):
            background[y * W + x] = pix[y * W + x]
    for y in list(range(16, 24)) + list(range(184, 192)):
        for x in range(8, 312):
            background[y * W + x] = pix[y * W + x]

    bm_a, sc_a, co_a = pack(background)
    bm_b, sc_b, co_b = pack(pix)
    apply_hud(bm_b, sc_b, co_b)

    jack_w, jack_h = used_size(JACK_A, 2)
    enemy_w, enemy_h = used_size(EN_A, 1)
    _up, ux0, ux1, uy = by_name["upper"]
    jack_x = ux0 + 8
    jack_y = uy - jack_h
    enemies = []
    for name in ("pyramid", "lowleft"):
        _n, x0, x1, y = by_name[name]
        emin = x0
        emax = x1 - enemy_w
        if emax < emin:
            emax = emin
        enemies.append((emin, emax, y - enemy_h))

    sprites = (
        encode_mc(JACK_A) + encode_mc(JACK_B) + encode_hi(EN_A)
        + encode_hi(EN_B) + encode_mc(LIFE)
    )

    under_bm, over_bm = [], []
    under_sc, over_sc = [], []
    under_co, over_co = [], []
    flash, cols, rows, ncells = [], [], [], []
    for cx, cy, cells in bombs:
        # Stored in a fixed 2 by 2 so the C side can index with one stride.
        while len(cells) < BOMB_CELLS:
            cells.append(cells[-1])
        ncells.append(min(BOMB_CELLS, len(bomb_cells(cx, cy))))
        real = bomb_cells(cx, cy)
        padded = list(real) + [real[-1]] * (BOMB_CELLS - len(real))
        for col, row in padded:
            off = row * 40 + col
            under_bm.extend(bm_a[off * 8:off * 8 + 8])
            over_bm.extend(bm_b[off * 8:off * 8 + 8])
            under_sc.append(sc_a[off])
            over_sc.append(sc_b[off])
            under_co.append(co_a[off])
            over_co.append(co_b[off])
            sc = sc_b[off]
            if (sc >> 4) == LTRED:
                flash.append(1)
            elif (sc & 15) == LTRED:
                flash.append(2)
            else:
                flash.append(0)
            cols.append(col)
            rows.append(row)

    os.makedirs(os.path.join(ROOT, "src"), exist_ok=True)
    board_path = os.path.join(ROOT, "src", "board.s")
    with open(board_path, "w") as f:
        f.write('; Generated by tools/makeboard.py. Do not edit.\n')
        f.write('.segment "BITMAP"\n')
        emit_bytes(f, bm_b)
        f.write('.segment "SCREEN"\n')
        emit_bytes(f, sc_b)
        f.write('.segment "SPRITES"\n')
        emit_bytes(f, sprites)
        f.write('.segment "RODATA"\n')
        f.write('.export _board_color\n_board_color:\n')
        emit_bytes(f, co_b)
        f.write('.export _font5\n_font5:\n')
        font = []
        for code in range(32, 91):
            font.extend(glyph_bits(chr(code)))
        emit_bytes(f, font)
        f.write('.export _bomb_count\n_bomb_count:\n        .byte %d\n' % len(bombs))
        f.write('.export _bomb_x\n_bomb_x:\n')
        emit_words(f, [b[0] for b in bombs])
        f.write('.export _bomb_y\n_bomb_y:\n')
        emit_bytes(f, [b[1] for b in bombs])
        f.write('.export _bomb_ncells\n_bomb_ncells:\n')
        emit_bytes(f, ncells)
        f.write('.export _bomb_col\n_bomb_col:\n')
        emit_bytes(f, cols)
        f.write('.export _bomb_row\n_bomb_row:\n')
        emit_bytes(f, rows)
        f.write('.export _bomb_under_bm\n_bomb_under_bm:\n')
        emit_bytes(f, under_bm)
        f.write('.export _bomb_over_bm\n_bomb_over_bm:\n')
        emit_bytes(f, over_bm)
        f.write('.export _bomb_under_sc\n_bomb_under_sc:\n')
        emit_bytes(f, under_sc)
        f.write('.export _bomb_over_sc\n_bomb_over_sc:\n')
        emit_bytes(f, over_sc)
        f.write('.export _bomb_under_co\n_bomb_under_co:\n')
        emit_bytes(f, under_co)
        f.write('.export _bomb_over_co\n_bomb_over_co:\n')
        emit_bytes(f, over_co)
        f.write('.export _bomb_flash\n_bomb_flash:\n')
        emit_bytes(f, flash)
        f.write('.export _plat_count\n_plat_count:\n        .byte %d\n' % len(plats))
        f.write('.export _plat_x\n_plat_x:\n')
        emit_words(f, [p[1] for p in plats])
        f.write('.export _plat_y\n_plat_y:\n')
        emit_bytes(f, [p[3] for p in plats])
        f.write('.export _plat_w\n_plat_w:\n')
        emit_words(f, [p[2] - p[1] + 1 for p in plats])
        f.write('.export _jack_x\n_jack_x:\n        .word %d\n' % jack_x)
        f.write('.export _jack_y\n_jack_y:\n        .word %d\n' % jack_y)
        f.write('.export _enemy_count\n_enemy_count:\n        .byte %d\n' % len(enemies))
        f.write('.export _enemy_x\n_enemy_x:\n')
        emit_words(f, [e[0] for e in enemies])
        f.write('.export _enemy_max\n_enemy_max:\n')
        emit_words(f, [e[1] for e in enemies])
        f.write('.export _enemy_y\n_enemy_y:\n')
        emit_bytes(f, [e[2] for e in enemies])

    hud_path = os.path.join(ROOT, "src", "hud.inc")
    with open(hud_path, "w") as f:
        f.write("/* Generated by tools/makeboard.py. */\n")
        f.write("#define PLAY_X0 %d\n" % PLAY_X0)
        f.write("#define PLAY_Y0 %d\n" % PLAY_Y0)
        f.write("#define PLAY_X1 %d\n" % PLAY_X1)
        f.write("#define PLAY_Y1 %d\n" % PLAY_Y1)
        f.write("#define JACK_W %d\n" % jack_w)
        f.write("#define JACK_H %d\n" % jack_h)
        f.write("#define ENEMY_W %d\n" % enemy_w)
        f.write("#define ENEMY_H %d\n" % enemy_h)
        f.write("#define BOMB_CELLS %d\n" % BOMB_CELLS)
        f.write("#define GLYPH_INK %d\n" % GLYPH_INK)
        f.write("#define GLYPH_PAPER %d\n" % GLYPH_PAPER)
        f.write("#define GREEN_INK %d\n" % GREEN_INK)
        f.write("#define GREEN_PAPER %d\n" % GREEN_PAPER)
        f.write("#define SCORE_COL 1\n#define SCORE_ROW 1\n#define SCORE_LEN 6\n")
        f.write("#define CHAIN_COL 31\n#define CHAIN_ROW 0\n")
        f.write("#define HI_COL 31\n#define HI_ROW 24\n#define HI_LEN 6\n")
        f.write("#define SPR_BASE 144\n")
        f.write("#define LIFE_X0 16\n#define LIFE_DX 22\n#define LIFE_Y 192\n")

    try:
        from PIL import Image
    except ImportError:
        Image = None
    if Image is not None:
        img = Image.new("RGB", (W, H))
        rgb = img.load()
        for row in range(25):
            for col in range(40):
                off = row * 40 + col
                for yy in range(8):
                    b = bm_b[off * 8 + yy]
                    for xx in range(4):
                        pair = (b >> (6 - xx * 2)) & 3
                        if pair == 0:
                            c = BLUE
                        elif pair == 1:
                            c = sc_b[off] >> 4
                        elif pair == 2:
                            c = sc_b[off] & 15
                        else:
                            c = co_b[off] & 7
                        sx = col * 8 + xx * 2
                        sy = row * 8 + yy
                        rgb[sx, sy] = PEPTO[c]
                        rgb[sx + 1, sy] = PEPTO[c]
        blit_sprites(img, sprites, jack_x, jack_y, enemies)
        img.save(os.path.join(ROOT, "preview.png"))

    print("bombs %d" % len(bombs))
    for name, x0, x1, y in plats:
        print("plat %s x %d-%d y %d" % (name, x0, x1, y))
    print("jack %d,%d  %dx%d" % (jack_x, jack_y, jack_w, jack_h))
    for e in enemies:
        print("enemy %d..%d y %d" % e)
    for i, b in enumerate(bombs):
        print("bomb %2d %3d,%3d" % (i, b[0], b[1]))
    print("rodata bytes", 1000 + len(font) + len(under_bm) * 2 + len(under_sc) * 6)


def blit_sprites(img, sprites, jack_x, jack_y, enemies):
    def mc(data, x, y, body):
        cols = [None, PEPTO[WHITE], PEPTO[body], PEPTO[BLUE]]
        for row in range(21):
            if y + row < 0 or y + row >= H:
                continue
            for by in range(3):
                b = data[row * 3 + by]
                for px_i in range(4):
                    pair = (b >> (6 - px_i * 2)) & 3
                    if not pair:
                        continue
                    sx = x + (by * 4 + px_i) * 2
                    if 0 <= sx < W:
                        img.putpixel((sx, y + row), cols[pair])
                    if 0 <= sx + 1 < W:
                        img.putpixel((sx + 1, y + row), cols[pair])

    def hi(data, x, y):
        for row in range(21):
            if y + row < 0 or y + row >= H:
                continue
            for by in range(3):
                b = data[row * 3 + by]
                for bit in range(8):
                    if b & (0x80 >> bit):
                        sx = x + by * 8 + bit
                        if 0 <= sx < W:
                            img.putpixel((sx, y + row), PEPTO[WHITE])

    mc(sprites[0:64], jack_x, jack_y, RED)
    hi(sprites[128:192], enemies[0][0], enemies[0][2])
    hi(sprites[192:256], enemies[1][0], enemies[1][2])
    for i in range(3):
        mc(sprites[256:320], 16 + i * 22, 192, RED)


if __name__ == "__main__":
    main()
