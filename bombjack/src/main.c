/*
 * First board of Bomb Jack on the C64.
 *
 * The picture is a multicolor bitmap in VIC bank 1:
 *   bitmap  $4000-$5F3F
 *   screen  $6000-$63E7   sprite pointers at $63F8
 *   sprites $6400         five pictures, 64 bytes each
 * Colour RAM is copied from board_color because it lives at $D800.
 * Code, the bomb restore tables and the stack stay below $4000 and
 * above the sprites. Jack and the life markers are multicolor sprites.
 * The two robots are hires, so they can be white while Jack stays red.
 */

#include <c64.h>
#include <6502.h>
#include <string.h>
#include "hud.inc"

#define IN_UP    0x01
#define IN_DOWN  0x02
#define IN_LEFT  0x04
#define IN_RIGHT 0x08
#define IN_FIRE  0x10

/* Speeds are eighths of a pixel per frame. */
#define RUN          12
#define GRAVITY      1
#define JUMP_VY     -10
#define LIFT         2
#define LIFT_UP      4
#define HOLD_FRAMES  8
#define HOLD_UP      30
#define RISE_CAP    -18
#define RISE_CAP_UP -48
#define FALL_CAP     10
#define FAST_FALL    12
#define FAST_CAP     24
#define SLOW_FALL    3
#define FLUTTER      10

#define MAX_EN   4
#define MAX_BOMB 24

extern unsigned char board_color[];
extern unsigned char font5[];
extern unsigned char bomb_count;
extern unsigned int bomb_x[];
extern unsigned char bomb_y[];
extern unsigned char bomb_ncells[];
extern unsigned char bomb_col[];
extern unsigned char bomb_row[];
extern unsigned char bomb_under_bm[];
extern unsigned char bomb_over_bm[];
extern unsigned char bomb_under_sc[];
extern unsigned char bomb_over_sc[];
extern unsigned char bomb_under_co[];
extern unsigned char bomb_over_co[];
extern unsigned char bomb_flash[];
extern unsigned char plat_count;
extern unsigned int plat_x[];
extern unsigned char plat_y[];
extern unsigned int plat_w[];
extern unsigned int jack_x;
extern unsigned int jack_y;
extern unsigned char enemy_count;
extern unsigned int enemy_x[];
extern unsigned int enemy_max[];
extern unsigned char enemy_y[];

static unsigned char alive[MAX_BOMB];
static unsigned char remain;
static unsigned char lit;
static unsigned char mult;
static unsigned char lives;
static unsigned char lock;
static unsigned char grounded;
static unsigned char drop;
static unsigned char jump_on;
static unsigned char jump_hold;
static unsigned char flutter;
static unsigned char hurt;
static unsigned char win;
static unsigned char gameover;
static unsigned char fire_lock;
static unsigned char edir[MAX_EN];
static unsigned int ex[MAX_EN];
static unsigned int tick;
static unsigned long score;
static unsigned long hiscore;
static int jx;
static int jy;
static int vx;
static int vy;

/* Column is active-low on port A. Row is a bit of port B.
   held is the port-1 stick, which pulls those rows low in every column. */
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
        v |= IN_UP;             /* W, column 1 row 1 */
    }
    if (key_down((unsigned char)~0x02, 0x04, joy1)) {
        v |= IN_LEFT;           /* A, column 1 row 2 */
    }
    if (key_down((unsigned char)~0x02, 0x20, joy1)) {
        v |= IN_DOWN;           /* S, column 1 row 5 */
    }
    if (key_down((unsigned char)~0x04, 0x04, joy1)) {
        v |= IN_RIGHT;          /* D, column 2 row 2 */
    }
    if (key_down((unsigned char)~0x80, 0x10, joy1)) {
        v |= IN_FIRE;           /* space, column 7 row 4 */
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

static void put_char(unsigned char col, unsigned char row, char ch,
                     unsigned char ink, unsigned char paper) {
    unsigned char i;
    unsigned char x;
    unsigned char bits;
    unsigned char b;
    unsigned char *cell;
    const unsigned char *g;

    /* cc65 stores 'A'..'Z' as PETSCII $C1..$DA. The font table is ASCII. */
    if (ch >= 0xC1 && ch <= 0xDA) {
        ch = (char)(ch - 0x80);
    }
    if (ch < 32 || ch > 90) {
        ch = 32;
    }
    g = font5 + (unsigned int)(ch - 32) * 5;
    cell = (unsigned char *)0x4000 + ((unsigned int)row * 40 + col) * 8;
    for (i = 0; i < 5; ++i) {
        bits = g[i];
        b = 0;
        for (x = 0; x < 3; ++x) {
            b <<= 2;
            if (bits & (unsigned char)(4 >> x)) {
                b |= ink;
            } else {
                b |= paper;
            }
        }
        cell[1 + i] = (unsigned char)((b << 2) | paper);
    }
}

static void write_str(unsigned char col, unsigned char row, const char *s) {
    while (*s) {
        put_char(col, row, *s, GLYPH_INK, GLYPH_PAPER);
        ++col;
        ++s;
    }
}

static void write_num(unsigned char col, unsigned char row, unsigned long v,
                     unsigned char n, unsigned char zeros,
                     unsigned char ink, unsigned char paper) {
    char buf[8];
    unsigned char i;
    unsigned long q;

    q = v;
    for (i = n; i > 0; --i) {
        buf[i - 1] = (char)('0' + (unsigned char)(q % 10));
        q /= 10;
    }
    if (!zeros) {
        i = 0;
        while (i + 1 < n && buf[i] == '0') {
            buf[i] = ' ';
            ++i;
        }
    }
    for (i = 0; i < n; ++i) {
        put_char((unsigned char)(col + i), row, buf[i], ink, paper);
    }
}

static void draw_score(void) {
    unsigned char i;

    write_num(SCORE_COL, SCORE_ROW, score, SCORE_LEN, 1, GLYPH_INK, GLYPH_PAPER);
    for (i = SCORE_LEN; i < SCORE_LEN + 6; ++i) {
        put_char((unsigned char)(SCORE_COL + i), SCORE_ROW, ' ', GLYPH_INK, GLYPH_PAPER);
    }
}

static void draw_hi(void) {
    write_num(HI_COL, HI_ROW, hiscore, HI_LEN, 0, GLYPH_INK, GLYPH_PAPER);
}

static void draw_mult(void) {
    unsigned char tens;
    unsigned char ones;

    tens = (unsigned char)(mult / 10);
    ones = (unsigned char)(mult % 10);
    put_char(CHAIN_COL, CHAIN_ROW, 'X', GREEN_INK, GREEN_PAPER);
    if (tens) {
        put_char((unsigned char)(CHAIN_COL + 1), CHAIN_ROW,
                 (char)('0' + tens), GREEN_INK, GREEN_PAPER);
    } else {
        put_char((unsigned char)(CHAIN_COL + 1), CHAIN_ROW, ' ', GREEN_INK, GREEN_PAPER);
    }
    put_char((unsigned char)(CHAIN_COL + 2), CHAIN_ROW,
             (char)('0' + ones), GREEN_INK, GREEN_PAPER);
}

static void add_score(unsigned long pts) {
    score += pts;
    if (score > 999999UL) {
        score = 999999UL;
    }
    if (score > hiscore) {
        hiscore = score;
        draw_hi();
    }
    draw_score();
    draw_mult();
}

static void blip(unsigned char hi, unsigned char wave) {
    unsigned char *s;

    s = (unsigned char *)0xD400;
    s[5] = 0x00;
    s[6] = 0xF6;
    s[0] = 0x00;
    s[1] = hi;
    s[4] = wave;
    s[24] = 0x0F;
}

static unsigned char blip_t;

static void blip_on(unsigned char hi, unsigned char wave) {
    blip(hi, wave);
    blip_t = 8;
}

static void blip_tick(void) {
    if (blip_t) {
        --blip_t;
        if (blip_t == 0) {
            ((unsigned char *)0xD400)[4] = 0x00;
        }
    }
}

static void blit_bomb(unsigned char i, unsigned char over, unsigned char flashc) {
    unsigned char c;
    unsigned char n;
    unsigned char col;
    unsigned char row;
    unsigned char sc;
    unsigned char fl;
    unsigned int cell;
    unsigned int base;
    unsigned char *src;

    n = bomb_ncells[i];
    for (c = 0; c < n; ++c) {
        base = (unsigned int)i * BOMB_CELLS + c;
        col = bomb_col[base];
        row = bomb_row[base];
        cell = (unsigned int)row * 40 + col;
        if (over) {
            src = bomb_over_bm + base * 8;
        } else {
            src = bomb_under_bm + base * 8;
        }
        memcpy((unsigned char *)0x4000 + cell * 8, src, 8);
        if (over) {
            sc = bomb_over_sc[base];
            fl = bomb_flash[base];
            if (flashc && fl == 1) {
                sc = (unsigned char)((sc & 0x0F) | (flashc << 4));
            } else if (flashc && fl == 2) {
                sc = (unsigned char)((sc & 0xF0) | flashc);
            }
            ((unsigned char *)0x6000)[cell] = sc;
            ((unsigned char *)0xD800)[cell] = bomb_over_co[base];
        } else {
            ((unsigned char *)0x6000)[cell] = bomb_under_sc[base];
            ((unsigned char *)0xD800)[cell] = bomb_under_co[base];
        }
    }
}

static void jack_home(void) {
    jx = (int)jack_x << 3;
    jy = (int)jack_y << 3;
    vx = 0;
    vy = 0;
    grounded = 1;
    lock = 0;
    drop = 0;
    jump_hold = 0;
    flutter = 0;
}

static void refill(void) {
    unsigned char i;

    for (i = 0; i < bomb_count && i < MAX_BOMB; ++i) {
        alive[i] = 1;
        blit_bomb(i, 1, 0);
    }
    remain = i;
    lit = 0;
    mult = 1;
    draw_mult();
}

static void reset_enemies(void) {
    unsigned char i;

    for (i = 0; i < enemy_count && i < MAX_EN; ++i) {
        ex[i] = enemy_x[i];
        edir[i] = 1;
    }
}

static void reset_game(void) {
    score = 0;
    lives = 3;
    draw_score();
    refill();
    jack_home();
    reset_enemies();
    hurt = 0;
    win = 0;
    gameover = 0;
    fire_lock = 0;
}

static int iabs(int v) {
    if (v < 0) {
        return -v;
    }
    return v;
}

static unsigned char overlap(int ax, int ay, unsigned char aw, unsigned char ah,
                            int bx, int by, unsigned char bw, unsigned char bh) {
    if (ax + aw <= bx || bx + bw <= ax) {
        return 0;
    }
    if (ay + ah <= by || by + bh <= ay) {
        return 0;
    }
    return 1;
}

static void move_jack(unsigned char in) {
    int px;
    int py;
    int old_foot;
    int new_foot;
    int left;
    int right;
    int cap;
    unsigned char p;
    unsigned char jump;
    unsigned char pressed;
    unsigned char took_off;

    jump = (unsigned char)((in & IN_FIRE) != 0);
    pressed = (unsigned char)(jump && !jump_on);
    took_off = 0;

    if (in & IN_LEFT) {
        vx = -RUN;
    } else if (in & IN_RIGHT) {
        vx = RUN;
    } else {
        vx = 0;
    }
    jx += vx;
    px = jx >> 3;
    if (px < PLAY_X0) {
        px = PLAY_X0;
        vx = 0;
        jx = px << 3;
    }
    if (px + JACK_W > PLAY_X1) {
        px = PLAY_X1 - JACK_W;
        vx = 0;
        jx = px << 3;
    }

    if (grounded) {
        left = px + 2;
        right = px + JACK_W - 2;
        jump_hold = 0;
        flutter = 0;
        if ((in & IN_DOWN) && lock != 255) {
            grounded = 0;
            drop = 8;
            vy = FAST_FALL;
        } else if (pressed) {
            grounded = 0;
            took_off = 1;
            vy = JUMP_VY;
            if (in & IN_UP) {
                jump_hold = HOLD_UP;
            } else {
                jump_hold = HOLD_FRAMES;
            }
        } else if (lock == 255) {
            vy = 0;
        } else if (right <= (int)plat_x[lock] ||
                   left >= (int)plat_x[lock] + (int)plat_w[lock]) {
            grounded = 0;
            vy = 0;
        } else {
            vy = 0;
            jy = ((int)plat_y[lock] - JACK_H) << 3;
        }
    }

    if (!grounded) {
        if (!took_off && pressed && vy < 0) {
            vy = 0;
            jump_hold = 0;
        } else if (!took_off && pressed) {
            flutter = FLUTTER;
            vy = SLOW_FALL;
        }
        if (in & IN_DOWN) {
            flutter = 0;
            jump_hold = 0;
            if (vy < FAST_FALL) {
                vy = FAST_FALL;
            }
            if (vy > FAST_CAP) {
                vy = FAST_CAP;
            }
        } else if (flutter) {
            --flutter;
            if (vy > SLOW_FALL) {
                vy = SLOW_FALL;
            }
        } else {
            vy += GRAVITY;
            if (vy > FALL_CAP) {
                vy = FALL_CAP;
            }
        }
        if (jump && jump_hold && vy < 0) {
            if (in & IN_UP) {
                vy -= LIFT_UP;
                cap = RISE_CAP_UP;
            } else {
                vy -= LIFT;
                cap = RISE_CAP;
            }
            if (vy < cap) {
                vy = cap;
            }
            --jump_hold;
        }
        old_foot = (jy >> 3) + JACK_H;
        jy += vy;
        py = jy >> 3;
        if (py < PLAY_Y0) {
            py = PLAY_Y0;
            vy = 0;
            jump_hold = 0;
            jy = py << 3;
        }
        if (py + JACK_H > PLAY_Y1) {
            py = PLAY_Y1 - JACK_H;
            vy = 0;
            grounded = 1;
            lock = 255;
            jy = py << 3;
        }
        new_foot = py + JACK_H;
        if (drop) {
            --drop;
        }
        if (!grounded && !drop && !(in & IN_DOWN) && vy >= 0) {
            left = px + 2;
            right = px + JACK_W - 2;
            for (p = 0; p < plat_count; ++p) {
                if (old_foot <= (int)plat_y[p] && new_foot >= (int)plat_y[p] &&
                    right > (int)plat_x[p] &&
                    left < (int)plat_x[p] + (int)plat_w[p]) {
                    grounded = 1;
                    lock = p;
                    vy = 0;
                    flutter = 0;
                    jy = ((int)plat_y[p] - JACK_H) << 3;
                    break;
                }
            }
        }
    }
    jump_on = jump;
}

static void move_enemies(void) {
    unsigned char i;

    if (tick & 1) {
        return;
    }
    for (i = 0; i < enemy_count && i < MAX_EN; ++i) {
        if (edir[i]) {
            if (ex[i] < enemy_max[i]) {
                ++ex[i];
            } else {
                edir[i] = 0;
            }
        } else if (ex[i] > enemy_x[i]) {
            --ex[i];
        } else {
            edir[i] = 1;
        }
    }
}

static void advance_lit(void) {
    unsigned char i;
    unsigned char k;
    unsigned char n;

    n = bomb_count;
    if (n > MAX_BOMB) {
        n = MAX_BOMB;
    }
    for (i = 1; i <= n; ++i) {
        k = (unsigned char)((lit + i) % n);
        if (alive[k]) {
            lit = k;
            return;
        }
    }
}

static void collect(void) {
    unsigned char i;
    int dx;
    int dy;
    unsigned long pts;

    if (bomb_count > MAX_BOMB) {
        return;
    }
    for (i = 0; i < bomb_count; ++i) {
        if (!alive[i]) {
            continue;
        }
        dx = (jx >> 3) + JACK_W / 2 - (int)bomb_x[i];
        dy = (jy >> 3) + JACK_H / 2 - (int)bomb_y[i];
        if (iabs(dx) >= 12 || iabs(dy) >= 12) {
            continue;
        }
        alive[i] = 0;
        blit_bomb(i, 0, 0);
        if (remain) {
            --remain;
        }
        if (i == lit) {
            pts = 200UL * mult;
            if (mult < 64) {
                mult *= 2;
            }
            add_score(pts);
            blip_on(0x48, 0x21);
            advance_lit();
        } else {
            mult = 1;
            add_score(100UL);
            blip_on(0x18, 0x11);
        }
    }
}

static void hurt_jack(void) {
    unsigned char i;

    if (hurt || gameover) {
        return;
    }
    for (i = 0; i < enemy_count && i < MAX_EN; ++i) {
        if (overlap(jx >> 3, jy >> 3, JACK_W, JACK_H,
                    (int)ex[i], (int)enemy_y[i], ENEMY_W, ENEMY_H)) {
            blip_on(0x08, 0x81);
            hurt = 100;
            if (lives) {
                --lives;
            }
            if (lives == 0) {
                gameover = 1;
                fire_lock = 1;
                write_str(SCORE_COL, SCORE_ROW, "GAME OVER");
            } else {
                jack_home();
            }
            return;
        }
    }
}

static void place(unsigned char n, int x, int y, unsigned char *hix) {
    unsigned int sx;

    sx = (unsigned int)(x + 24);
    VIC.spr_pos[n].x = (unsigned char)sx;
    VIC.spr_pos[n].y = (unsigned char)(y + 50);
    if (sx > 255) {
        *hix |= (unsigned char)(1 << n);
    }
}

static void place_sprites(void) {
    unsigned char *ptr;
    unsigned char hix;
    unsigned char ena;
    unsigned char i;
    unsigned char frame;
    unsigned char flashc;

    ptr = (unsigned char *)0x63F8;
    frame = (unsigned char)((tick >> 3) & 1);
    if (vx || vy) {
        ptr[0] = (unsigned char)(SPR_BASE + frame);
    } else {
        ptr[0] = SPR_BASE;
    }
    ptr[1] = (unsigned char)(SPR_BASE + 2 + frame);
    ptr[2] = (unsigned char)(SPR_BASE + 2 + frame);
    ptr[5] = (unsigned char)(SPR_BASE + 4);
    ptr[6] = (unsigned char)(SPR_BASE + 4);
    ptr[7] = (unsigned char)(SPR_BASE + 4);

    hix = 0;
    place(0, jx >> 3, jy >> 3, &hix);
    for (i = 0; i < enemy_count && i < MAX_EN; ++i) {
        place((unsigned char)(1 + i), (int)ex[i], (int)enemy_y[i], &hix);
    }
    for (i = 0; i < 3; ++i) {
        place((unsigned char)(5 + i), LIFE_X0 + (int)i * LIFE_DX, LIFE_Y, &hix);
    }
    VIC.spr_hi_x = hix;

    ena = 0x01;
    if (hurt && (tick & 4) == 0) {
        ena = 0;
    }
    for (i = 0; i < enemy_count && i < 2; ++i) {
        ena |= (unsigned char)(1 << (1 + i));
    }
    for (i = 0; i < lives && i < 3; ++i) {
        ena |= (unsigned char)(1 << (5 + i));
    }
    VIC.spr_ena = ena;

    if (remain && alive[lit]) {
        flashc = 0;
        if (((tick >> 3) & 3) == 1 || ((tick >> 3) & 3) == 3) {
            flashc = COLOR_YELLOW;
        } else if (((tick >> 3) & 3) == 2) {
            flashc = COLOR_WHITE;
        }
        blit_bomb(lit, 1, flashc);
    }
}

static void frame(unsigned char in) {
    if (gameover) {
        if (in & IN_FIRE) {
            if (!fire_lock) {
                reset_game();
            }
        } else {
            fire_lock = 0;
        }
        VIC.bordercolor = COLOR_RED;
        place_sprites();
        blip_tick();
        return;
    }

    move_jack(in);
    move_enemies();
    if (!hurt) {
        collect();
        hurt_jack();
    } else {
        --hurt;
    }

    if (win) {
        --win;
        if (win == 0) {
            refill();
            jack_home();
        }
        VIC.bordercolor = (tick & 8) ? COLOR_YELLOW : COLOR_ORANGE;
    } else if (remain == 0) {
        add_score(1000UL);
        blip_on(0x60, 0x21);
        win = 140;
        VIC.bordercolor = COLOR_YELLOW;
    } else if (hurt > 80) {
        VIC.bordercolor = COLOR_RED;
    } else {
        VIC.bordercolor = COLOR_BLACK;
    }

    place_sprites();
    blip_tick();
}

static void setup(void) {
    unsigned char i;

    SEI();
    CIA1.icr = 0x7F;
    CIA2.icr = 0x7F;
    VIC.imr = 0;
    CIA1.ddrb = 0x00;
    VIC.ctrl1 = 0x0B;

    memcpy((unsigned char *)0xD800, board_color, 1000);

    CIA2.ddra |= 0x03;
    CIA2.pra = (unsigned char)((CIA2.pra & 0xFC) | 0x02);
    VIC.addr = 0x80;
    VIC.ctrl2 = 0x18;
    VIC.bgcolor0 = COLOR_BLUE;
    VIC.bordercolor = COLOR_BLACK;

    for (i = 0; i < 24; ++i) {
        ((unsigned char *)0xD400)[i] = 0;
    }
    ((unsigned char *)0xD400)[24] = 0x0F;

    VIC.spr_mcolor0 = COLOR_WHITE;
    VIC.spr_mcolor1 = COLOR_BLUE;
    VIC.spr_mcolor = 0xE1;
    VIC.spr_exp_x = 0;
    VIC.spr_exp_y = 0;
    VIC.spr_bg_prio = 0;
    VIC.spr0_color = COLOR_RED;
    VIC.spr1_color = COLOR_WHITE;
    VIC.spr2_color = COLOR_WHITE;
    VIC.spr5_color = COLOR_RED;
    VIC.spr6_color = COLOR_RED;
    VIC.spr7_color = COLOR_RED;

    hiscore = 10000UL;
    score = 0;
    reset_game();
    place_sprites();
    VIC.ctrl1 = 0x3B;
}

int main(void) {
    unsigned char in;

    setup();
    while (1) {
        wait_frame();
        ++tick;
        in = joy();
        frame(in);
    }
    return 0;
}
