/*
 * One screen of a Lode Runner, read from the sphinx-free still of
 * Loderunner_Animation.gif. Bricks, ladders, ropes and gold are 10x10
 * pictures in a multicolor bitmap. The runner and the three guards
 * are hires sprites.
 *
 * Tiles are original drawings. The picture in the gif is only the map.
 */

#include <c64.h>
#include <6502.h>
#include <string.h>

#define IN_UP    0x01
#define IN_DOWN  0x02
#define IN_LEFT  0x04
#define IN_RIGHT 0x08
#define IN_FIRE  0x10

/* 28 columns. Each block is 10 pixels wide and 11 tall, inset 20
   pixels from the side and 11 from the top. The status letters use
   the same 10-pixel columns. */
#define COLS     28
#define ROWS     16
#define TILE     10
#define TILE_H   11
#define OX       20
#define OY       11
/* The last row is not an 11-pixel tile. A four-pixel bar sits under
   the floor, then the status line. */
#define STRIPE_Y 176
#define HUD_Y    184

#define T_EMPTY  0
#define T_BRICK  1
#define T_LADDER 2
#define T_ROPE   3
#define T_GOLD   4

#define GUARDS   3
#define HOLES    4
#define HOLE_TIME 160
#define TRAP_OUT  110

#define PLAY     0
#define WAIT     1
#define OVER     2
#define CAUSE_DEAD 1
#define CAUSE_WIN  2

/* Body matches one 10x10 block. The picture is one pixel taller
   than the block and lines up with its left edge. */
#define BODY       10
#define SPRITE_DX  0
#define SPRITE_LIFT 1
#define PLAYER_SPEED 4
#define GUARD_SPEED  2
#define SPRITE_BASE 144

extern unsigned char bitmap[];
extern unsigned char screen[];
extern unsigned char sprites[];

/* Bit 4 is the leftmost of five multicolor pixels. A block is 10
   pixels wide and 11 tall. The brick picture is 10 pixels, and the
   11th pixel is the gap before the next row. Ladder rails cross
   that gap. */
static const unsigned int PAT_BRICK[11] = {
    0x1D, 0x1D, 0x1D, 0x1D, 0x00,
    0x17, 0x17, 0x17, 0x17, 0x17,
    0x00
};
static const unsigned int PAT_LADDER[11] = {
    0x12, 0x12, 0x1E, 0x12, 0x12,
    0x12, 0x1E, 0x12, 0x12, 0x12,
    0x12
};
static const unsigned int PAT_ROPE[11] = {
    0x00, 0x1F, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00,
    0x00
};
static const unsigned int PAT_CHEST[11] = {
    0x00, 0x00, 0x00, 0x00, 0x00,
    0x1E, 0x12, 0x12, 0x12, 0x1E,
    0x00
};
static const unsigned int PAT_GEM[11] = {
    0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x0C, 0x0C, 0x0C, 0x00,
    0x00
};
/* Four solid rows. The rest stays clear so the bar is not a tile. */
static const unsigned int PAT_STRIPE[11] = {
    0x1F, 0x1F, 0x1F, 0x1F, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00,
    0x00
};

/* Status letters are 10 by 10, like the bricks. Bit 4 is the leftmost
   of five multicolor pixels. The fifth pixel is the gap, so the next
   letter starts on the next column. The last two rows are the gap
   under the letter. */
static const unsigned int G_SPACE[11] = {
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
};
static const unsigned int G_0[11] = {
    0x1E, 0x12, 0x12, 0x12, 0x16, 0x16, 0x16, 0x1E, 0x00, 0x00
};
static const unsigned int G_1[11] = {
    0x0C, 0x0C, 0x04, 0x04, 0x04, 0x04, 0x0E, 0x0E, 0x00, 0x00
};
static const unsigned int G_2[11] = {
    0x1E, 0x12, 0x02, 0x1E, 0x10, 0x10, 0x16, 0x1E, 0x00, 0x00
};
static const unsigned int G_3[11] = {
    0x1E, 0x02, 0x02, 0x0E, 0x02, 0x02, 0x02, 0x1E, 0x00, 0x00
};
static const unsigned int G_4[11] = {
    0x12, 0x12, 0x12, 0x1E, 0x02, 0x02, 0x02, 0x02, 0x00, 0x00
};
static const unsigned int G_5[11] = {
    0x1E, 0x10, 0x10, 0x1E, 0x06, 0x06, 0x06, 0x1E, 0x00, 0x00
};
static const unsigned int G_6[11] = {
    0x1E, 0x10, 0x10, 0x1E, 0x12, 0x12, 0x12, 0x1E, 0x00, 0x00
};
static const unsigned int G_7[11] = {
    0x1E, 0x02, 0x02, 0x04, 0x04, 0x08, 0x08, 0x08, 0x00, 0x00
};
static const unsigned int G_8[11] = {
    0x1E, 0x12, 0x12, 0x1E, 0x12, 0x12, 0x12, 0x1E, 0x00, 0x00
};
static const unsigned int G_9[11] = {
    0x1E, 0x12, 0x12, 0x1E, 0x02, 0x02, 0x02, 0x1E, 0x00, 0x00
};
static const unsigned int G_A[11] = {
    0x1E, 0x12, 0x12, 0x1E, 0x12, 0x12, 0x12, 0x12, 0x00, 0x00
};
static const unsigned int G_C[11] = {
    0x1E, 0x12, 0x10, 0x10, 0x18, 0x18, 0x1A, 0x1E, 0x00, 0x00
};
static const unsigned int G_E[11] = {
    0x1E, 0x18, 0x18, 0x1C, 0x10, 0x10, 0x10, 0x1E, 0x00, 0x00
};
static const unsigned int G_G[11] = {
    0x1E, 0x12, 0x10, 0x10, 0x16, 0x12, 0x12, 0x1E, 0x00, 0x00
};
static const unsigned int G_L[11] = {
    0x10, 0x10, 0x10, 0x10, 0x18, 0x18, 0x18, 0x1E, 0x00, 0x00
};
static const unsigned int G_M[11] = {
    0x12, 0x1A, 0x1E, 0x1E, 0x12, 0x12, 0x12, 0x12, 0x00, 0x00
};
static const unsigned int G_N[11] = {
    0x12, 0x12, 0x1A, 0x1E, 0x1E, 0x16, 0x12, 0x12, 0x00, 0x00
};
static const unsigned int G_O[11] = {
    0x1E, 0x16, 0x16, 0x12, 0x12, 0x12, 0x12, 0x1E, 0x00, 0x00
};
static const unsigned int G_R[11] = {
    0x1E, 0x12, 0x12, 0x1E, 0x1C, 0x1C, 0x1A, 0x1A, 0x00, 0x00
};
static const unsigned int G_S[11] = {
    0x1E, 0x12, 0x10, 0x1E, 0x06, 0x06, 0x16, 0x1E, 0x00, 0x00
};
static const unsigned int G_V[11] = {
    0x1A, 0x1A, 0x1A, 0x1A, 0x1A, 0x1E, 0x0C, 0x08, 0x00, 0x00
};

/*
 * Columns run left to right. # brick, H ladder, - rope, * gold.
 * Row 14 is the floor you can dig. Row 15 is the bedrock under it.
 */
static const char *plan[ROWS] = {
    "....*.......................",
    "#######H#######.............",
    ".......H----------..........",
    ".......H...............*....",
    ".......H....##H...#######H##",
    ".......H....##H..........H..",
    ".......H....##H.......*..H..",
    "##H#####....########H#######",
    "..H.................H.......",
    "#########H##########H.......",
    ".........H----------H.......",
    ".......*.H..........H...*...",
    "....H######.........#######H",
    "....H............*.........H",
    "############################",
    "############################"
};

static unsigned char map[ROWS][COLS];
static unsigned char hole_c[HOLES];
static unsigned char hole_r[HOLES];
static unsigned char hole_t[HOLES];

static int px;
static int py;
static int gx[GUARDS];
static int gy[GUARDS];
static unsigned char galive[GUARDS];
static unsigned char gtrap[GUARDS];
static unsigned char gwait[GUARDS];
static const unsigned char gsc[GUARDS] = {20, 15, 22};
static const unsigned char gsr[GUARDS] = {4, 9, 14};

static unsigned char lives;
static unsigned char level_no;
static unsigned char gold_left;
static unsigned char phase;
static unsigned char cause;
static unsigned char wait;
static unsigned char fire_was;
static unsigned char pframe;
static unsigned char pface;
static unsigned char gface[GUARDS];
static unsigned int tick;
static unsigned char sound_t;
static unsigned char sound_wave;
static unsigned long score;
static unsigned char div10[320];
static unsigned char div11[320];

static unsigned char key_down(unsigned char column, unsigned char row,
                              unsigned char held) {
    CIA1.pra = column;
    return (unsigned char)(((CIA1.prb | held) & row) == 0);
}

static unsigned char joy(void) {
    unsigned char v;
    unsigned char r;
    unsigned char joy1;
    unsigned char joy2;

    v = 0;
    CIA1.ddra = 0xFF;
    CIA1.pra = 0xFF;
    joy1 = (unsigned char)((~CIA1.prb) & 0x1F);

    CIA1.ddra = 0x00;
    r = CIA1.pra;
    r = CIA1.pra;
    joy2 = (unsigned char)((~r) & 0x1F);

    CIA1.ddra = 0xFF;
    CIA1.pra = 0xFF;
    if (key_down((unsigned char)~0x02, 0x02, joy1)) {
        v |= IN_UP;
    }
    if (key_down((unsigned char)~0x02, 0x04, joy1)) {
        v |= IN_LEFT;
    }
    if (key_down((unsigned char)~0x02, 0x20, joy1)) {
        v |= IN_DOWN;
    }
    if (key_down((unsigned char)~0x04, 0x04, joy1)) {
        v |= IN_RIGHT;
    }
    if (key_down((unsigned char)~0x80, 0x10, joy1)) {
        v |= IN_FIRE;
    }
    CIA1.pra = 0xFF;
    v |= joy1;
    v |= joy2;
    return v;
}

static void wait_frame(void) {
    while (VIC.rasterline < 250) {}
    while (VIC.rasterline >= 250) {}
}

static void blip(unsigned char hi, unsigned char wave) {
    unsigned char *s;

    s = (unsigned char *)0xD400;
    s[4] = 0x00;
    s[5] = 0x09;
    s[6] = 0x00;
    s[0] = 0x00;
    s[1] = hi;
    s[4] = wave;
    s[24] = 0x0F;
    sound_wave = wave;
    sound_t = 12;
}

static void sound_tick(void) {
    if (!sound_t) {
        return;
    }
    --sound_t;
    if (!sound_t) {
        ((unsigned char *)0xD400)[4] = (unsigned char)(sound_wave & 0xFE);
    }
}

static void make_div10(void) {
    unsigned int i;
    unsigned char q;
    unsigned char r;

    q = 0;
    r = 0;
    for (i = 0; i < 320; ++i) {
        div10[i] = q;
        ++r;
        if (r == TILE) {
            r = 0;
            ++q;
        }
    }
    q = 0;
    r = 0;
    for (i = 0; i < 320; ++i) {
        div11[i] = q;
        ++r;
        if (r == TILE_H) {
            r = 0;
            ++q;
        }
    }
}

static unsigned char tile_color(unsigned char t) {
    if (t == T_BRICK) {
        return COLOR_RED;
    }
    if (t == T_LADDER || t == T_ROPE) {
        return COLOR_WHITE;
    }
    return COLOR_BLACK;
}

/* Background stays black. A multicolor cell holds three more inks,
   so a shared cell keeps every block's own color. */
extern void blit_block(const unsigned int *rows, unsigned int x,
                       unsigned int y, unsigned char color);
static void draw_stripe(void);
static int stand_y(unsigned char row);

static void blit_tile(unsigned char c, unsigned char r) {
    unsigned char t;
    const unsigned int *rows;

    t = map[r][c];
    rows = 0;
    /* The bedrock row is kept for collision. On screen it is the bar. */
    if (r + 1 >= ROWS) {
        return;
    }
    if (t == T_BRICK) {
        rows = PAT_BRICK;
    } else if (t == T_LADDER) {
        /* A ladder in a floor keeps the same 10x10 brick behind its rails. */
        if ((c > 0 && map[r][c - 1] == T_BRICK) ||
            (c + 1 < COLS && map[r][c + 1] == T_BRICK)) {
            blit_block(PAT_BRICK, (unsigned int)(OX + (int)c * TILE),
                       (unsigned int)(OY + (int)r * TILE_H), COLOR_RED);
        }
        rows = PAT_LADDER;
    } else if (t == T_ROPE) {
        rows = PAT_ROPE;
    }
    if (t == T_GOLD) {
        blit_block(PAT_CHEST, (unsigned int)(OX + (int)c * TILE),
                   (unsigned int)(OY + (int)r * TILE_H), COLOR_WHITE);
        blit_block(PAT_GEM, (unsigned int)(OX + (int)c * TILE),
                   (unsigned int)(OY + (int)r * TILE_H), COLOR_RED);
        return;
    }
    if (rows) {
        blit_block(rows, (unsigned int)(OX + (int)c * TILE),
                   (unsigned int)(OY + (int)r * TILE_H), tile_color(t));
    }
}

static void blit_span(unsigned char c0, unsigned char c1,
                      unsigned char r0, unsigned char r1) {
    unsigned char c;
    unsigned char r;
    unsigned char t;

    for (r = r0; r <= r1; ++r) {
        for (c = c0; c <= c1; ++c) {
            if (map[r][c] == T_BRICK) {
                blit_tile(c, r);
            }
        }
    }
    for (r = r0; r <= r1; ++r) {
        for (c = c0; c <= c1; ++c) {
            t = map[r][c];
            if (t == T_LADDER || t == T_ROPE) {
                blit_tile(c, r);
            }
        }
    }
    for (r = r0; r <= r1; ++r) {
        for (c = c0; c <= c1; ++c) {
            if (map[r][c] == T_GOLD) {
                blit_tile(c, r);
            }
        }
    }
}

static const unsigned int *glyph_rows(char ch) {
    static const char name[] = "0123456789ACEGLMNORSV";
    static const unsigned int *const tab[] = {
        G_0, G_1, G_2, G_3, G_4, G_5, G_6, G_7, G_8, G_9,
        G_A, G_C, G_E, G_G, G_L, G_M, G_N, G_O, G_R, G_S, G_V
    };
    unsigned char i;

    i = 0;
    while (name[i]) {
        if (name[i] == ch) {
            return tab[i];
        }
        ++i;
    }
    return G_SPACE;
}

/* Clear five multicolor pixels by ten rows. A later letter must not
   leave the previous digit behind, and it must not erase its neighbor. */
static void wipe_mc(unsigned int x, unsigned int y) {
    unsigned char row;
    unsigned char col;
    unsigned char shift;
    unsigned int xx;
    unsigned int yy;
    unsigned int off;

    for (row = 0; row < TILE; ++row) {
        yy = y + row;
        for (col = 0; col < 5; ++col) {
            xx = x + (unsigned int)col * 2;
            off = (yy >> 3) * 320 + (xx >> 3) * 8 + (yy & 7);
            shift = (unsigned char)(6 - (xx & 6));
            bitmap[off] = (unsigned char)(bitmap[off] &
                          (unsigned char)~(3U << shift));
        }
    }
}

static void draw_glyph(unsigned char col, unsigned int y, char ch,
                       unsigned char color) {
    unsigned int x;

    x = (unsigned int)(OX + (int)col * TILE);
    wipe_mc(x, y);
    blit_block(glyph_rows(ch), x, y, color);
}

static void put_str(unsigned char col, unsigned int y, const char *s,
                    unsigned char color) {
    while (*s) {
        draw_glyph(col, y, *s, color);
        ++col;
        ++s;
    }
}

static void draw_num(unsigned char col, unsigned int y, unsigned long v,
                     unsigned char n, unsigned char color) {
    unsigned char i;
    char buf[8];
    unsigned long q;

    q = v;
    for (i = n; i > 0; --i) {
        buf[i - 1] = (char)('0' + (unsigned char)(q % 10));
        q /= 10;
    }
    for (i = 0; i < n; ++i) {
        draw_glyph((unsigned char)(col + i), y, buf[i], color);
    }
}

static void draw_hud(void) {
    put_str(0, HUD_Y, "SCORE", COLOR_RED);
    draw_num(5, HUD_Y, score, 7, COLOR_CYAN);
    put_str(13, HUD_Y, "MEN", COLOR_RED);
    draw_num(16, HUD_Y, lives, 3, COLOR_CYAN);
    put_str(20, HUD_Y, "LEVEL", COLOR_RED);
    draw_num(25, HUD_Y, level_no, 3, COLOR_CYAN);
}

static void clear_hw(unsigned char cx, unsigned char cy) {
    unsigned char row;
    unsigned int off;

    screen[(unsigned int)cy * 40 + cx] = 0;
    COLOR_RAM[(unsigned int)cy * 40 + cx] = 0;
    off = (unsigned int)cy * 320 + (unsigned int)cx * 8;
    for (row = 0; row < 8; ++row) {
        bitmap[off + row] = 0;
    }
}

/* A 10-pixel block shares 8-pixel cells with its neighbors. Keep
   growing the patch until every cell we erase is covered by a block
   we draw back, or a picked-up chest leaves a hole in the brick. */
static void draw_cell(unsigned char c, unsigned char r) {
    unsigned char c0;
    unsigned char c1;
    unsigned char r0;
    unsigned char r1;
    unsigned char nc0;
    unsigned char nc1;
    unsigned char nr0;
    unsigned char nr1;
    unsigned char cx;
    unsigned char cy;
    unsigned char x0c;
    unsigned char y0c;
    unsigned char x1c;
    unsigned char y1c;
    unsigned char guard;
    int x0;
    int y0;
    int x1;
    int y1;

    c0 = c;
    c1 = c;
    r0 = r;
    r1 = r;
    x0c = 0;
    y0c = 0;
    x1c = 0;
    y1c = 0;
    for (guard = 0; guard < 8; ++guard) {
        x0 = OX + (int)c0 * TILE;
        y0 = OY + (int)r0 * TILE_H;
        x1 = OX + ((int)c1 + 1) * TILE - 1;
        y1 = OY + ((int)r1 + 1) * TILE_H - 1;
        x0c = (unsigned char)((x0 >> 3));
        y0c = (unsigned char)((y0 >> 3));
        x1c = (unsigned char)((x1 >> 3));
        y1c = (unsigned char)((y1 >> 3));
        x0 = (int)x0c << 3;
        y0 = (int)y0c << 3;
        x1 = ((int)x1c << 3) + 7;
        y1 = ((int)y1c << 3) + 7;
        if (x0 <= OX) {
            nc0 = 0;
        } else {
            nc0 = div10[x0 - OX];
        }
        if (y0 <= OY) {
            nr0 = 0;
        } else {
            nr0 = div11[y0 - OY];
        }
        if (x1 >= OX + COLS * TILE) {
            nc1 = COLS - 1;
        } else {
            nc1 = div10[x1 - OX];
        }
        if (y1 >= OY + ROWS * TILE_H) {
            nr1 = ROWS - 1;
        } else {
            nr1 = div11[y1 - OY];
        }
        if (nc0 == c0 && nc1 == c1 && nr0 == r0 && nr1 == r1) {
            break;
        }
        c0 = nc0;
        c1 = nc1;
        r0 = nr0;
        r1 = nr1;
    }
    for (cy = y0c; cy <= y1c; ++cy) {
        for (cx = x0c; cx <= x1c; ++cx) {
            clear_hw(cx, cy);
        }
    }
    blit_span(c0, c1, r0, r1);
    if (r1 + 1 >= ROWS) {
        draw_stripe();
    }
}

static void draw_stripe(void) {
    unsigned char c;

    for (c = 0; c < COLS; ++c) {
        blit_block(PAT_STRIPE, (unsigned int)(OX + (int)c * TILE),
                   STRIPE_Y, COLOR_RED);
    }
}

static void draw_map(void) {
    unsigned int i;

    for (i = 0; i < 8000; ++i) {
        bitmap[i] = 0;
    }
    for (i = 0; i < 1000; ++i) {
        screen[i] = 0;
        COLOR_RAM[i] = 0;
    }
    blit_span(0, COLS - 1, 0, ROWS - 1);
    draw_stripe();
    draw_hud();
}

static void build_map(unsigned char keep_gold) {
    unsigned char c;
    unsigned char r;
    char ch;
    unsigned char t;

    gold_left = 0;
    for (r = 0; r < ROWS; ++r) {
        for (c = 0; c < COLS; ++c) {
            ch = plan[r][c];
            t = T_EMPTY;
            if (ch == '#') {
                t = T_BRICK;
            } else if (ch == 'H') {
                t = T_LADDER;
            } else if (ch == '-') {
                t = T_ROPE;
            } else if (ch == '*') {
                t = T_GOLD;
            }
            if (keep_gold && t == T_GOLD && map[r][c] != T_GOLD) {
                t = T_EMPTY;
            }
            map[r][c] = t;
            if (t == T_GOLD) {
                ++gold_left;
            }
        }
    }
    for (c = 0; c < HOLES; ++c) {
        hole_t[c] = 0;
    }
}

static unsigned char cell(int x, int y) {
    int dx;
    int dy;

    if (y < OY) {
        return T_EMPTY;
    }
    if (x < OX) {
        return T_BRICK;
    }
    dx = x - OX;
    dy = y - OY;
    if (dx >= COLS * TILE || dy >= ROWS * TILE_H) {
        return T_BRICK;
    }
    return map[div11[dy]][div10[dx]];
}

static unsigned char solid(int x, int y) {
    return (unsigned char)(cell(x, y) == T_BRICK);
}

static unsigned char fits(int x, int y) {
    if (x < OX) {
        return 0;
    }
    if (x > OX + COLS * TILE - TILE) {
        return 0;
    }
    if (y < 0) {
        return 0;
    }
    if (y > OY + ROWS * TILE_H - BODY) {
        return 0;
    }
    if (solid(x, y) || solid(x + 9, y) || solid(x + 4, y)) {
        return 0;
    }
    if (solid(x, y + 4) || solid(x + 9, y + 4)) {
        return 0;
    }
    if (solid(x, y + 9) || solid(x + 9, y + 9) || solid(x + 4, y + 9)) {
        return 0;
    }
    return 1;
}

static void nudge_x(int *x, int y, int dir, unsigned char n) {
    unsigned char i;

    for (i = 0; i < n; ++i) {
        if (!fits(*x + dir, y)) {
            return;
        }
        *x += dir;
    }
}

static void nudge_y(int x, int *y, int dir, unsigned char n) {
    unsigned char i;
    int ny;

    for (i = 0; i < n; ++i) {
        ny = *y + dir;
        if (!fits(x, ny)) {
            return;
        }
        *y = ny;
    }
}

/* A ladder set into a floor is ground. A ladder with open sides is a shaft. */
static unsigned char is_floor(int x, int y) {
    int dx;
    int dy;
    unsigned char c;
    unsigned char r;

    if (y < OY || x < OX) {
        return 0;
    }
    dx = x - OX;
    dy = y - OY;
    if (dx >= COLS * TILE || dy >= ROWS * TILE_H) {
        return 0;
    }
    c = div10[dx];
    r = div11[dy];
    if (map[r][c] == T_BRICK) {
        return 1;
    }
    if (map[r][c] != T_LADDER) {
        return 0;
    }
    if (c > 0 && map[r][c - 1] == T_BRICK) {
        return 1;
    }
    if ((unsigned char)(c + 1) < COLS && map[r][c + 1] == T_BRICK) {
        return 1;
    }
    return 0;
}

static unsigned char grounded(int x, int y) {
    if (is_floor(x + 2, y + BODY) || is_floor(x + 7, y + BODY)) {
        return 1;
    }
    return 0;
}

/* Feet sit on the top of a floor. A 2-pixel step skips that line on an
   11-pixel row, and the body then sticks into the ladder and cannot
   step onto the bricks beside it. */
static int support_top(int x, int y) {
    int rel;
    unsigned char r;

    if (y + BODY < OY) {
        return -1;
    }
    rel = y + BODY - OY;
    if (rel > 319) {
        rel = 319;
    }
    if (!is_floor(x + 4, OY + rel)) {
        return -1;
    }
    r = div11[rel];
    return stand_y(r);
}

static void plant_feet(int x, int *y) {
    int top;

    top = support_top(x, *y);
    if (top < 0) {
        return;
    }
    if (*y > top && *y < top + TILE_H && fits(x, top)) {
        *y = top;
    }
}

static void climb_up(int x, int *y, unsigned char n) {
    unsigned char i;
    int ny;
    int top;

    for (i = 0; i < n; ++i) {
        ny = *y - 1;
        top = support_top(x, *y);
        if (top >= 0 && ny < top &&
            cell(x + 4, ny + 4) != T_LADDER &&
            cell(x + 4, ny + BODY) != T_LADDER) {
            return;
        }
        if (!fits(x, ny)) {
            return;
        }
        *y = ny;
    }
}

static unsigned char ladder_here(int x, int y) {
    if (cell(x + 4, y + 4) == T_LADDER) {
        return 1;
    }
    if (cell(x + 4, y + BODY) == T_LADDER) {
        return 1;
    }
    return 0;
}

static unsigned char rope_here(int x, int y) {
    if (cell(x + 4, y + 4) == T_ROPE) {
        return 1;
    }
    return 0;
}

static int stand_y(unsigned char row) {
    return OY + (int)row * TILE_H - BODY;
}

static int stand_x(unsigned char col) {
    return OX + (int)col * TILE;
}

static int snap_ladder(int x, int y) {
    int c;
    int dx;

    dx = x + 4 - OX;
    if (dx < 0) {
        dx = 0;
    }
    c = div10[dx];
    if (c >= COLS) {
        c = COLS - 1;
    }
    if (cell(OX + c * TILE + 4, y + 4) != T_LADDER &&
        c > 0 && cell(OX + (c - 1) * TILE + 4, y + 4) == T_LADDER) {
        --c;
    }
    return OX + c * TILE;
}

static unsigned char body_in_hole(int x, int y) {
    unsigned char i;
    int hl;
    int ht;

    for (i = 0; i < HOLES; ++i) {
        if (!hole_t[i]) {
            continue;
        }
        hl = OX + (int)hole_c[i] * TILE;
        ht = OY + (int)hole_r[i] * TILE_H;
        if (x + 9 >= hl && x < hl + TILE && y + (BODY - 1) >= ht &&
            y < ht + TILE_H) {
            return 1;
        }
    }
    return 0;
}

static void place_actors(void) {
    unsigned char i;

    px = stand_x(8);
    py = stand_y(14);
    pframe = 0;
    pface = 0;
    for (i = 0; i < GUARDS; ++i) {
        gx[i] = stand_x(gsc[i]);
        gy[i] = stand_y(gsr[i]);
        galive[i] = 1;
        gtrap[i] = 0;
        gwait[i] = 0;
        gface[i] = 0;
    }
}

static void grab_gold(int x, int y) {
    int c;
    int r;

    if (x + 4 < OX || y + 4 < OY) {
        return;
    }
    c = div10[x + 4 - OX];
    r = div11[y + 4 - OY];
    if (c >= COLS || r >= ROWS) {
        return;
    }
    if (map[r][c] != T_GOLD) {
        return;
    }
    map[r][c] = T_EMPTY;
    draw_cell((unsigned char)c, (unsigned char)r);
    if (gold_left) {
        --gold_left;
    }
    score += 250UL;
    if (score > 9999999UL) {
        score = 9999999UL;
    }
    draw_hud();
    blip(0x30, 0x11);
}

static void try_dig(int x, int y, unsigned char side) {
    int c;
    int r;
    int tc;
    unsigned char i;

    if (x + 4 < OX || y + BODY < OY) {
        return;
    }
    c = div10[x + 4 - OX];
    r = div11[y + BODY - OY];
    if (side == 1) {
        tc = c - 1;
    } else {
        tc = c + 1;
    }
    if (tc < 0 || tc >= COLS || r < 0 || r >= ROWS - 1) {
        return;
    }
    if (map[r][tc] != T_BRICK) {
        return;
    }
    for (i = 0; i < HOLES; ++i) {
        if (!hole_t[i]) {
            hole_c[i] = (unsigned char)tc;
            hole_r[i] = (unsigned char)r;
            hole_t[i] = HOLE_TIME;
            map[r][tc] = T_EMPTY;
            draw_cell((unsigned char)tc, (unsigned char)r);
            blip(0x18, 0x81);
            return;
        }
    }
}

static void kill_player(void) {
    if (phase != PLAY) {
        return;
    }
    blip(0x08, 0x81);
    if (lives) {
        --lives;
    }
    draw_hud();
    VIC.bordercolor = COLOR_RED;
    if (lives == 0) {
        phase = OVER;
        put_str(9, 148, "GAME OVER", COLOR_RED);
        fire_was = 1;
        return;
    }
    phase = WAIT;
    cause = CAUSE_DEAD;
    wait = 40;
}

static void bury(unsigned char c, unsigned char r) {
    unsigned char i;
    int left;
    int top;

    left = OX + (int)c * TILE;
    top = OY + (int)r * TILE_H;
    if (px + 4 >= left && px + 4 < left + TILE &&
        py + 4 >= top && py + 4 < top + TILE_H) {
        kill_player();
    }
    for (i = 0; i < GUARDS; ++i) {
        if (!galive[i]) {
            continue;
        }
        if (gx[i] + 4 >= left && gx[i] + 4 < left + TILE &&
            gy[i] + 4 >= top && gy[i] + 4 < top + TILE_H) {
            galive[i] = 0;
            gwait[i] = 90;
            gtrap[i] = 0;
            score += 75UL;
            if (score > 9999999UL) {
                score = 9999999UL;
            }
            draw_hud();
            blip(0x10, 0x81);
        }
    }
}

static void holes_tick(void) {
    unsigned char i;

    for (i = 0; i < HOLES; ++i) {
        if (!hole_t[i]) {
            continue;
        }
        --hole_t[i];
        if (!hole_t[i]) {
            bury(hole_c[i], hole_r[i]);
            map[hole_r[i]][hole_c[i]] = T_BRICK;
            draw_cell(hole_c[i], hole_r[i]);
        }
    }
}

static void move_player(unsigned char in) {
    int nx;
    int ny;
    unsigned char dig;
    unsigned char climbing;
    unsigned char leaving;
    unsigned char step;
    int dir;

    dig = 0;
    climbing = 0;
    leaving = 0;
    if ((in & IN_FIRE) && !fire_was) {
        if (in & IN_LEFT) {
            dig = 1;
        } else if (in & IN_RIGHT) {
            dig = 2;
        }
    }
    fire_was = (unsigned char)((in & IN_FIRE) != 0);

    if (dig) {
        try_dig(px, py, dig);
    } else if ((in & IN_UP) && ladder_here(px, py)) {
        nx = snap_ladder(px, py);
        if (fits(nx, py)) {
            px = nx;
        }
        for (step = 0; step < PLAYER_SPEED; ++step) {
            if (gold_left && py - 1 < stand_y(1)) {
                break;
            }
            ny = py;
            climb_up(px, &py, 1);
            if (py == ny) {
                break;
            }
            climbing = 1;
        }
    } else if ((in & IN_DOWN) && rope_here(px, py) && !ladder_here(px, py)) {
        ny = py + TILE_H;
        if (fits(px, ny)) {
            py = ny;
        }
    } else if ((in & IN_DOWN) &&
               (ladder_here(px, py) || cell(px + 4, py + BODY) == T_LADDER)) {
        nx = snap_ladder(px, py);
        if (fits(nx, py)) {
            px = nx;
        }
        nudge_y(px, &py, 1, PLAYER_SPEED);
        climbing = 1;
    } else if ((in & (IN_LEFT | IN_RIGHT)) && body_in_hole(px, py)) {
        dir = (in & IN_LEFT) ? -1 : 1;
        for (step = 0; step < PLAYER_SPEED; ++step) {
            if (fits(px + dir, py) && grounded(px + dir, py)) {
                px += dir;
            } else if (fits(px, py - 1)) {
                py -= 1;
            }
        }
        leaving = 1;
        climbing = 1;
    } else if (in & IN_LEFT) {
        plant_feet(px, &py);
        nudge_x(&px, py, -1, PLAYER_SPEED);
    } else if (in & IN_RIGHT) {
        plant_feet(px, &py);
        nudge_x(&px, py, 1, PLAYER_SPEED);
    }

    if (!leaving && !grounded(px, py) && !ladder_here(px, py) &&
        !rope_here(px, py)) {
        nudge_y(px, &py, 1, PLAYER_SPEED);
        climbing = 0;
    }

    if (!climbing) {
        plant_feet(px, &py);
    }

    if (climbing) {
        pframe = 2;
    } else if (rope_here(px, py) && !grounded(px, py)) {
        pframe = 3;
    } else if (in & (IN_LEFT | IN_RIGHT)) {
        pframe = (tick & 4) ? 1 : 0;
    } else {
        pframe = 0;
    }
    if (in & IN_LEFT) {
        pface = 0;
    } else if (in & IN_RIGHT) {
        pface = 1;
    }
    grab_gold(px, py);
}

static int chase_x(int x, int y) {
    int best;
    int dist;
    int c;
    int xx;
    int d;

    if (py + TILE_H > y && y + TILE_H > py) {
        return px;
    }
    best = x;
    dist = 999;
    for (c = 0; c < COLS; ++c) {
        xx = OX + c * TILE;
        if (cell(xx + 4, y + 4) == T_LADDER ||
            cell(xx + 4, y + BODY) == T_LADDER) {
            d = xx - x;
            if (d < 0) {
                d = -d;
            }
            if (d < dist) {
                dist = d;
                best = xx;
            }
        }
    }
    return best;
}

static void step_guard(unsigned char i) {
    int x;
    int y;
    int nx;
    int tx;
    int dir;
    int dist;

    if (!galive[i]) {
        if (gwait[i]) {
            --gwait[i];
            return;
        }
        gx[i] = stand_x(gsc[i]);
        gy[i] = stand_y(gsr[i]);
        galive[i] = 1;
        gtrap[i] = 0;
        return;
    }

    x = gx[i];
    y = gy[i];
    if (gtrap[i]) {
        if (!grounded(x, y)) {
            nudge_y(x, &gy[i], 1, GUARD_SPEED);
            plant_feet(x, &gy[i]);
            return;
        }
        if (gtrap[i] < 255) {
            ++gtrap[i];
        }
        if (gtrap[i] > TRAP_OUT) {
            dir = (px >= x) ? 1 : -1;
            gface[i] = (unsigned char)(dir > 0);
            if (fits(x + dir, y) && grounded(x + dir, y)) {
                gx[i] = x + dir;
                plant_feet(gx[i], &y);
                gy[i] = y;
                gtrap[i] = 0;
            } else {
                climb_up(x, &gy[i], GUARD_SPEED);
            }
        }
        return;
    }

    if (!grounded(x, y) && !ladder_here(x, y) && !rope_here(x, y)) {
        nudge_y(x, &gy[i], 1, GUARD_SPEED);
        plant_feet(x, &gy[i]);
        if (body_in_hole(x, gy[i])) {
            gtrap[i] = 1;
        }
        return;
    }

    if (ladder_here(x, y) && py + 4 < y) {
        nx = snap_ladder(x, y);
        if (fits(nx, y)) {
            x = nx;
        }
        climb_up(x, &y, GUARD_SPEED);
        gx[i] = x;
        gy[i] = y;
        return;
    }
    if (py > y + 10 &&
        (ladder_here(x, y) || cell(x + 4, y + BODY) == T_LADDER)) {
        nx = snap_ladder(x, y);
        if (fits(nx, y)) {
            x = nx;
        }
        nudge_y(x, &y, 1, GUARD_SPEED);
        gx[i] = x;
        gy[i] = y;
        return;
    }

    tx = chase_x(x, y);
    dist = tx - x;
    if (dist < 0) {
        dist = -dist;
    }
    dir = 0;
    if (tx < x) {
        dir = -1;
        gface[i] = 0;
    } else if (tx > x) {
        dir = 1;
        gface[i] = 1;
    }
    if (dist > GUARD_SPEED) {
        dist = GUARD_SPEED;
    }
    if (dir && rope_here(x, y) && !grounded(x, y)) {
        nudge_x(&x, y, dir, (unsigned char)dist);
        gx[i] = x;
        return;
    }
    if (dir) {
        plant_feet(x, &y);
        nudge_x(&x, y, dir, (unsigned char)dist);
        gx[i] = x;
        gy[i] = y;
    }
}

static void collide(void) {
    unsigned char i;
    int dx;
    int dy;

    for (i = 0; i < GUARDS; ++i) {
        if (!galive[i]) {
            continue;
        }
        dx = px - gx[i];
        dy = py - gy[i];
        if (dx < 0) {
            dx = -dx;
        }
        if (dy < 0) {
            dy = -dy;
        }
        if (dx < 6 && dy < 10) {
            kill_player();
            return;
        }
    }
}

static void check_win(void) {
    if (gold_left) {
        return;
    }
    if (py < stand_y(1)) {
        phase = WAIT;
        cause = CAUSE_WIN;
        wait = 80;
        VIC.bordercolor = COLOR_YELLOW;
        blip(0x60, 0x11);
    }
}

static void sprite_on(unsigned char n, int x, int y, unsigned char frame,
                      unsigned char on, unsigned char *ena, unsigned char *hi) {
    unsigned int sx;

    if (!on) {
        return;
    }
    sx = (unsigned int)(x - SPRITE_DX + 24);
    VIC.spr_pos[n].x = (unsigned char)sx;
    VIC.spr_pos[n].y = (unsigned char)(y - SPRITE_LIFT + 50);
    if (sx > 255) {
        *hi |= (unsigned char)(1 << n);
    }
    screen[0x3F8 + n] = (unsigned char)(SPRITE_BASE + frame);
    *ena |= (unsigned char)(1 << n);
}

static void place_sprites(void) {
    unsigned char i;
    unsigned char ena;
    unsigned char hi;
    unsigned char fr;

    ena = 0;
    hi = 0;
    fr = pframe;
    if (pface) {
        fr = (unsigned char)(fr + 4);
    }
    sprite_on(0, px, py, fr, 1, &ena, &hi);
    for (i = 0; i < GUARDS; ++i) {
        fr = 0;
        if (gtrap[i]) {
            fr = 2;
        } else if (tick & 4) {
            fr = 1;
        }
        if (gface[i]) {
            fr = (unsigned char)(fr + 4);
        }
        sprite_on((unsigned char)(1 + i), gx[i], gy[i], fr, galive[i], &ena, &hi);
    }
    VIC.spr_hi_x = hi;
    VIC.spr_ena = ena;
}

static void setup_vic(void) {
    unsigned char i;

    CIA2.ddra |= 0x03;
    CIA2.pra = (unsigned char)((CIA2.pra & 0xFC) | 0x02);
    VIC.addr = 0x80;
    VIC.ctrl2 = 0x18;
    VIC.bgcolor0 = COLOR_BLACK;
    VIC.bordercolor = COLOR_BLACK;
    VIC.spr_mcolor = 0;
    VIC.spr_exp_x = 0;
    VIC.spr_exp_y = 0;
    VIC.spr_bg_prio = 0;
    VIC.spr0_color = COLOR_WHITE;
    VIC.spr1_color = COLOR_CYAN;
    VIC.spr2_color = COLOR_CYAN;
    VIC.spr3_color = COLOR_CYAN;
    for (i = 0; i < 24; ++i) {
        ((unsigned char *)0xD400)[i] = 0;
    }
    ((unsigned char *)0xD400)[24] = 0x0F;
    memcpy((void *)0x6400, sprites, 512);
}

static void new_game(void) {
    score = 0;
    lives = 5;
    level_no = 1;
    build_map(0);
    place_actors();
    draw_map();
    phase = PLAY;
    fire_was = 1;
    VIC.bordercolor = COLOR_BLACK;
}

static void next_level(void) {
    if (level_no < 255) {
        ++level_no;
    }
    build_map(0);
    place_actors();
    draw_map();
    phase = PLAY;
    VIC.bordercolor = COLOR_BLACK;
}

static void respawn(void) {
    build_map(1);
    place_actors();
    draw_map();
    phase = PLAY;
    VIC.bordercolor = COLOR_BLACK;
}

int main(void) {
    unsigned char in;
    unsigned char i;

    SEI();
    CIA1.icr = 0x7F;
    CIA2.icr = 0x7F;
    VIC.imr = 0;
    CIA1.ddrb = 0x00;
    VIC.ctrl1 = 0x0B;

    make_div10();
    setup_vic();
    new_game();
    VIC.ctrl1 = 0x3B;

    while (1) {
        wait_frame();
        sound_tick();
        ++tick;
        in = joy();
        if (phase == PLAY) {
            move_player(in);
            for (i = 0; i < GUARDS; ++i) {
                step_guard(i);
            }
            holes_tick();
            if (phase == PLAY) {
                collide();
            }
            if (phase == PLAY) {
                check_win();
            }
        } else if (phase == WAIT) {
            if (wait) {
                --wait;
            }
            if (!wait) {
                if (cause == CAUSE_WIN) {
                    next_level();
                } else {
                    respawn();
                }
            }
        } else if (in & IN_FIRE) {
            if (!fire_was) {
                new_game();
            }
        } else {
            fire_was = 0;
        }
        place_sprites();
    }
    return 0;
}
