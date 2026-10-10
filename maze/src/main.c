/*
 * PETSCII maze with a hardware-scrolled viewport.
 *
 * The map is 160x100 characters. Row 0 is a fixed status line. The
 * maze below it is 40 by 24 characters. The man walks while the camera
 * stays put. When he comes within five characters of an edge, input
 * locks and the view slides eight characters, or up to the edge of the
 * map, one character at a time. There is no pixel fine-scroll. The
 * slide gets the whole machine. Control returns when it has finished.
 *
 * Measured against that window (sprite coordinates):
 *   sprite_x = 31 + world_x - camera_x
 *   sprite_y = 66 + world_y - camera_y
 * The man moves two pixels a frame.
 *
 * Tiles are stored as screen codes. PETSCII equivalents:
 *   wall  screen 160 = PETSCII 160 (reverse space, a solid block)
 *   floor screen 102 = PETSCII 166 (checkerboard)
 */

#include <c64.h>
#include <6502.h>
#include <stdlib.h>
#include <string.h>
#include <peekpoke.h>

#define MAP_W           160
#define MAP_H           100
#define MAP_PX_W        (MAP_W * 8)
#define MAP_PX_H        (MAP_H * 8)

/* One wall character between cells, three open characters inside. */
#define STEP            4
#define PATH            3
#define CELLS_X         39
#define CELLS_Y         24

#define WALL            160
#define FLOOR           102
#define HEART           83            /* life bar, screen code */
#define DIAMOND         90            /* PETSCII diamond, screen code */
#define DOOR            31            /* PETSCII left arrow, screen code */
#define OUTER           161           /* map only; drawn as a blue wall */
#define BOMB_BODY       81            /* circle, screen code */
#define FUSE_CHAR       85            /* PETSCII 117 */
#define FUSE_REVERSE    213           /* same glyph, reversed on a wall */
#define STAR_CHAR       42
#define BOMB_SLOTS      3
#define FUSE_FRAMES     150           /* three seconds at 50 Hz */
#define BLAST_FRAMES    50            /* one second */
#define STUN_FRAMES     1000          /* twenty seconds */
#define PICKUPS         10
#define GHOSTS          4
#define LIFE_MAX        10
#define TIME_START      600           /* ten minutes */
#define FAR_AWAY        80
#define HURT_FRAMES     40

#define TITLE_ROWS      1           /* status line */
#define PLAY_ROWS       24          /* screen rows 1..24 */
#ifndef PLAY_COLS
#define PLAY_COLS       40
#endif
#define PLAY_COL0       ((40 - PLAY_COLS) / 2)
#define VIEW_W          (PLAY_COLS * 8)
#define VIEW_H          192
/* Start a slide when the man is this close to the view edge, and
   slide by this many pixels (both multiples of the 2-pixel step). */
#define SCROLL_EDGE     40
#define SCROLL_AMOUNT   64
#define SPEED           2
/* Last camera position whose playfield still lands inside the map.
   Slides step a whole character, so this is a multiple of 8. The old
   fine-scroll limit was 7 pixels further, and that leftover made the
   right edge look unfinished: up and down were never started. */
#define CAM_MAX_X       ((MAP_W - PLAY_COLS) * 8)
#define CAM_MAX_Y       (MAP_PX_H - VIEW_H)

#define HIT_W           8
#define HIT_H           12

#define IN_UP           0x01
#define IN_DOWN         0x02
#define IN_LEFT         0x04
#define IN_RIGHT        0x08

#define SCREEN_A        ((unsigned char*)0x0400)
#define SCREEN_B        ((unsigned char*)0x3800)
#define SCREEN          SCREEN_A
#define SPRITE_RAM      ((unsigned char*)0x3C00)
#define GHOST_RAM       ((unsigned char*)0x3D00)
#define SPRITE_PTR_A    ((unsigned char*)0x07F8)
#define SPRITE_PTR_B    ((unsigned char*)0x3BF8)
#define SPRITE_BLOCK    240
#define GHOST_BLOCK     244

extern unsigned char sprite_frames[];
extern unsigned char ghost_sprite[];
extern unsigned char* shift_ss;
extern unsigned char* shift_sd;
extern unsigned char* shift_cs;
extern unsigned char* shift_cd;
extern void shift_view(unsigned char rows, unsigned char cols);
extern void blit_colors(unsigned char* src);
extern void install_irq(void);
extern void debug_jam(void);
extern void cyc_start(void);
extern void cyc_lap(void);
extern unsigned int cyc_max;
extern unsigned int cyc_min;
extern unsigned int cyc_last;
extern unsigned char cyc_over;
extern volatile unsigned char play_phase;
extern volatile unsigned char play_xreg;
extern volatile unsigned char screen_blank;
extern volatile unsigned char sprites_on;
extern void chase_ghosts(void);
extern void place_sprites(void);
extern void blank_status(void);
extern unsigned char ghost_head[];
extern void sound_init(void);
extern void sound_tick(void);
extern void sound_step(void);
extern void sound_door(void);
extern void __fastcall__ note_gem(unsigned char col, unsigned char row);
extern unsigned char door_tick(void);
extern unsigned char button_down(void);
extern void sound_sad(void);
extern void bomb_reset(void);
unsigned char gem_x[PICKUPS];
unsigned char gem_y[PICKUPS];

/* Shared with actors.s. That chase is written in assembly so the
   walk loop still finishes inside one frame. */
unsigned char map[MAP_H][MAP_W];
static unsigned char stack_x[CELLS_X * CELLS_Y];
static unsigned char stack_y[CELLS_X * CELLS_Y];

unsigned short player_x;
unsigned short player_y;
unsigned char player_dir;          /* 0 right, 1 left, 2 down, 3 up */
unsigned short cam_x;
unsigned short cam_y;
unsigned char origin_x;
unsigned char seam_y;              /* map row in screen row 3; 0xFF = none */
static unsigned char facing;       /* 0 right, 1 left */
static unsigned char walk_phase;
static unsigned char showing_b;    /* 0: $0400 visible, 1: $3800 */
static unsigned char flip_pending;
/* The color blit uses the whole frame. The next character copy waits. */
static unsigned char after_blit;
static unsigned char pred_x;       /* scroll being built into the hidden matrix */
static unsigned char pred_y;
static unsigned char pred_at;      /* rows already copied */
static unsigned char pred_ready;
static unsigned short seen_x;
static unsigned short seen_y;
unsigned short ghost_x[GHOSTS];
unsigned short ghost_y[GHOSTS];
unsigned char life;
unsigned char pickups_left;
static unsigned char door_run;
unsigned char hurt_cool;
unsigned char frame_div;
unsigned char outcome;          /* 0 play, 1 win, 2 lose */
unsigned int time_left;
static const unsigned char ghost_ink[GHOSTS] = {
    COLOR_RED, COLOR_PURPLE, COLOR_CYAN, COLOR_GREEN
};
unsigned char color_a[1000];
unsigned char color_b[1000];

static const signed char dir_x[4] = { 0, 0, -1, 1 };
static const signed char dir_y[4] = { -1, 1, 0, 0 };
static const unsigned char hit_x[2] = { 0, HIT_W - 1 };
static const unsigned char hit_y[3] = { 0, 6, HIT_H - 1 };

unsigned char bomb_x[BOMB_SLOTS];
unsigned char bomb_y[BOMB_SLOTS];
unsigned char bomb_phase[BOMB_SLOTS]; /* 0 empty, 1 fuse, 2 blast */
unsigned char bomb_timer[BOMB_SLOTS];
unsigned int bomb_mask[BOMB_SLOTS];
unsigned char bombs_left;
unsigned int ghost_freeze[GHOSTS];

#pragma code-name(push, "BOMB")
static unsigned char tile_color(unsigned char tile)
{
    if (tile == WALL) {
        return COLOR_LIGHTBLUE;
    }
    if (tile == OUTER) {
        return COLOR_BLUE;
    }
    /* Open-field test markers. Ordinary mazes never store these. */
    if (tile == 46) {
        return COLOR_GREEN;
    }
    if (tile == STAR_CHAR || tile == DIAMOND || tile == BOMB_BODY) {
        return COLOR_WHITE;
    }
    if (tile == DOOR) {
        return COLOR_YELLOW;
    }
    if (tile == 32) {
        return COLOR_BLACK;
    }
    return COLOR_GRAY1;
}
#pragma code-name(pop)

static void wait_frame(void)
{
    while ((*(volatile unsigned char*)0xD012) == 250) {}
    while ((*(volatile unsigned char*)0xD012) != 250) {}
}

/* The CIA timer keeps moving, so the border color changes on its own.
   Once the picture is on, the border stays black. */
static void spark_border(void)
{
    if (screen_blank) {
        *(volatile unsigned char*)0xD020 = *(volatile unsigned char*)0xDC04;
    }
}

static void publish_scroll(void)
{
    /* Character grid only. yscroll 3, 40 columns, xscroll 7. */
    play_phase = 0;
    play_xreg = 0xCF;
}

static unsigned char* vis_screen(void)
{
    return showing_b ? SCREEN_B : SCREEN_A;
}

static unsigned char* hid_screen(void)
{
    return showing_b ? SCREEN_A : SCREEN_B;
}

static unsigned char* vis_color(void)
{
    return showing_b ? color_b : color_a;
}

static unsigned char* hid_color(void)
{
    return showing_b ? color_a : color_b;
}

#pragma code-name(push, "BOMB")
static void plot_to(unsigned char* screen, unsigned char* color,
                    unsigned char sx, unsigned char sy,
                    unsigned char map_col, unsigned char map_row)
{
    unsigned int off;
    unsigned char tile;
    off = (unsigned int)sy * 40 + sx;
    tile = map[map_row][map_col];
    if (tile == OUTER) {
        screen[off] = WALL;
        color[off] = COLOR_BLUE;
        return;
    }
    screen[off] = tile;
    color[off] = tile_color(tile);
}
#pragma code-name(pop)

/* The first playfield row holds seam_y. 0xFF means that row is spare
   and the next row is map row 0. */
static unsigned char map_row_of(unsigned char sy, unsigned char base)
{
    if (base == 0xFF) {
        return (unsigned char)(sy - (TITLE_ROWS + 1));
    }
    return (unsigned char)(base + (sy - TITLE_ROWS));
}

static void plot_play(unsigned char* screen, unsigned char* color,
                      unsigned char sx, unsigned char sy,
                      unsigned char base_x, unsigned char base_y)
{
    unsigned int off;
    unsigned char row;
    unsigned char col;
    off = (unsigned int)sy * 40 + sx;
    if (base_y == 0xFF && sy <= TITLE_ROWS) {
        screen[off] = 32;
        color[off] = COLOR_BLACK;
        return;
    }
    row = map_row_of(sy, base_y);
    col = (unsigned char)(base_x + (unsigned char)(sx - PLAY_COL0));
    if (row >= MAP_H || col >= MAP_W) {
        screen[off] = WALL;
        color[off] = COLOR_LIGHTBLUE;
        return;
    }
    plot_to(screen, color, sx, sy, col, row);
}

static void draw_column(unsigned char* screen, unsigned char* color,
                        unsigned char sx, unsigned char base_x,
                        unsigned char base_y)
{
    unsigned char sy;
    for (sy = TITLE_ROWS; sy < TITLE_ROWS + PLAY_ROWS; sy++) {
        plot_play(screen, color, sx, sy, base_x, base_y);
    }
}

static void draw_row(unsigned char* screen, unsigned char* color,
                     unsigned char sy, unsigned char base_x,
                     unsigned char base_y)
{
    unsigned char sx;
    for (sx = PLAY_COL0; sx < PLAY_COL0 + PLAY_COLS; sx++) {
        plot_play(screen, color, sx, sy, base_x, base_y);
    }
}

static void redraw_view(unsigned char* screen, unsigned char* color)
{
    unsigned char sy;
    unsigned char sx;
    for (sy = TITLE_ROWS; sy < TITLE_ROWS + PLAY_ROWS; sy++) {
        spark_border();
        for (sx = PLAY_COL0; sx < PLAY_COL0 + PLAY_COLS; sx++) {
            plot_play(screen, color, sx, sy, origin_x, seam_y);
        }
    }
}

/* Copy nrows rows of the shifted view, starting at destination row row0.
   x_dir 1 moves content left, 2 moves it right.
   y_dir 1 moves content up, 2 moves it down. */
static void scroll_rect(unsigned char x_dir, unsigned char y_dir,
                        unsigned char row0, unsigned char nrows)
{
    unsigned int src_off;
    unsigned int dst_off;
    unsigned char cols;

    cols = PLAY_COLS;
    src_off = (unsigned int)row0 * 40 + PLAY_COL0;
    dst_off = src_off;
    if (x_dir == 1) {
        src_off += 1;
        cols = PLAY_COLS - 1;
    } else if (x_dir == 2) {
        dst_off += 1;
        cols = PLAY_COLS - 1;
    }
    if (y_dir == 1) {
        src_off += 40;
    } else if (y_dir == 2) {
        dst_off += 40;
    }
    shift_ss = vis_screen() + src_off;
    shift_sd = hid_screen() + dst_off;
    shift_cs = vis_color() + src_off;
    shift_cd = hid_color() + dst_off;
    shift_view(nrows, cols);
}

static void fill_edge(unsigned char x_dir, unsigned char y_dir,
                      unsigned char base_x, unsigned char base_y)
{
    unsigned char* screen;
    unsigned char* color;
    screen = hid_screen();
    color = hid_color();
    if (x_dir == 1) {
        draw_column(screen, color, (unsigned char)(PLAY_COL0 + PLAY_COLS - 1), base_x, base_y);
    } else if (x_dir == 2) {
        draw_column(screen, color, PLAY_COL0, base_x, base_y);
    }
    if (y_dir == 1) {
        draw_row(screen, color, (unsigned char)(TITLE_ROWS + PLAY_ROWS - 1), base_x, base_y);
    } else if (y_dir == 2) {
        draw_row(screen, color, TITLE_ROWS, base_x, base_y);
    }
}

static void shift_hidden(unsigned char x_dir, unsigned char y_dir)
{
    scroll_rect(x_dir, y_dir, TITLE_ROWS, y_dir ? (PLAY_ROWS - 1) : PLAY_ROWS);
    fill_edge(x_dir, y_dir, origin_x, seam_y);
}

/* The visible matrix is stable between character steps, so the next
   step is copied a few rows at a time. The wrap itself is then just
   a pointer flip and stays inside one frame. */
static void feed_scroll(unsigned char x_dir, unsigned char y_dir)
{
    unsigned char total;
    unsigned char n;
    unsigned char nx;
    unsigned char ny;

    if (x_dir == 1 && origin_x >= (unsigned char)(CAM_MAX_X >> 3)) x_dir = 0;
    if (x_dir == 2 && origin_x == 0) x_dir = 0;
    /* seam 0xFF is the spare row above the map. One step down reaches
       map row 0; one step up from row 0 goes back to the spare row. */
    if (y_dir == 1 && seam_y != 0xFF && seam_y >= (unsigned char)(MAP_H - PLAY_ROWS)) y_dir = 0;
    if (y_dir == 2 && seam_y == 0xFF) y_dir = 0;
    if (x_dir == 0 && y_dir == 0) {
        pred_x = 0;
        pred_y = 0;
        pred_at = 0;
        pred_ready = 0;
        return;
    }
    if (x_dir != pred_x || y_dir != pred_y) {
        pred_x = x_dir;
        pred_y = y_dir;
        pred_at = 0;
        pred_ready = 0;
    }
    if (pred_ready) {
        return;
    }
    total = y_dir ? (PLAY_ROWS - 1) : PLAY_ROWS;
    n = (unsigned char)(total - pred_at);
    if (n > 8) {
        n = 8;
    }
    /* pred_at counts playfield rows, starting at the first playfield row. */
    scroll_rect(x_dir, y_dir, (unsigned char)(TITLE_ROWS + pred_at), n);
    pred_at = (unsigned char)(pred_at + n);
    if (pred_at < total) {
        return;
    }
    nx = origin_x;
    ny = seam_y;
    if (x_dir == 1) nx++;
    else if (x_dir == 2) nx--;
    if (y_dir == 1) {
        ny = (seam_y == 0xFF) ? 0 : (unsigned char)(seam_y + 1);
    } else if (y_dir == 2) {
        ny = (seam_y == 0) ? 0xFF : (unsigned char)(seam_y - 1);
    }
    fill_edge(x_dir, y_dir, nx, ny);
    pred_ready = 1;
}

static void drop_pred(void)
{
    pred_x = 0;
    pred_y = 0;
    pred_at = 0;
    pred_ready = 0;
}

/* The fine-scroll counter wraps between phase 2 and phase 4 (yscroll
   1 becomes 7, which drops the picture 6 pixels). The character row
   has to step the other way on that same phase, or the maze leaps.
   Phases 0 and 2 keep the spare row; phases 4 and 6 have absorbed it. */
static unsigned char seam_for(unsigned char origin, unsigned char phase)
{
    if (phase < 4) {
        if (origin == 0) {
            return 0xFF;
        }
        return (unsigned char)(origin - 1);
    }
    return origin;
}

static int seam_value(unsigned char seam)
{
    if (seam == 0xFF) {
        return -1;
    }
    return (int)seam;
}

/* After a flip the hidden buffer is the one just displayed. Copy the
   next step into the other buffer before the registers swap. */
static void start_next_pred(unsigned char x_dir, unsigned char y_dir)
{
    if (x_dir == 0 && y_dir == 0) {
        return;
    }
    showing_b ^= 1;
    feed_scroll(x_dir, y_dir);
    showing_b ^= 1;
}

/*
 * Keep the hidden screen aligned with the camera. The visible matrix
 * is left alone until the border, where present_scroll() flips to it.
 * The character shift is spread over the frames before it is needed
 * so the wrap itself is only a pointer change.
 */
static void prepare_scroll(void)
{
    unsigned char nox;
    unsigned char noy;
    unsigned char nseam;
    unsigned char x_dir;
    unsigned char y_dir;
    unsigned char mx;
    unsigned char my;
    int sd;
    nox = (unsigned char)(cam_x >> 3);
    noy = (unsigned char)(cam_y >> 3);
    nseam = seam_for(noy, (unsigned char)(cam_y & 7));
    x_dir = 0;
    y_dir = 0;
    if (nox != origin_x) {
        if (nox == (unsigned char)(origin_x + 1)) {
            x_dir = 1;
        } else if (origin_x == (unsigned char)(nox + 1)) {
            x_dir = 2;
        } else {
            origin_x = nox;
            seam_y = nseam;
            redraw_view(hid_screen(), hid_color());
            flip_pending = 1;
            drop_pred();
            seen_x = cam_x;
            seen_y = cam_y;
            return;
        }
    }
    sd = seam_value(nseam) - seam_value(seam_y);
    if (sd != 0) {
        if (sd == 1) {
            y_dir = 1;
        } else if (sd == -1) {
            y_dir = 2;
        } else {
            origin_x = nox;
            seam_y = nseam;
            redraw_view(hid_screen(), hid_color());
            flip_pending = 1;
            drop_pred();
            seen_x = cam_x;
            seen_y = cam_y;
            return;
        }
    }
    if (x_dir != 0 || y_dir != 0) {
        origin_x = nox;
        seam_y = nseam;
        if (!(pred_ready && pred_x == x_dir && pred_y == y_dir)) {
            shift_hidden(x_dir, y_dir);
            flip_pending = 1;
            drop_pred();
        } else {
            flip_pending = 1;
            drop_pred();
            mx = 0;
            my = 0;
            if (cam_x > seen_x) mx = 1;
            else if (cam_x < seen_x) mx = 2;
            if (cam_y > seen_y) my = 1;
            else if (cam_y < seen_y) my = 2;
            start_next_pred(mx, my);
        }
    } else {
        mx = 0;
        my = 0;
        if (cam_x > seen_x) mx = 1;
        else if (cam_x < seen_x) mx = 2;
        if (cam_y > seen_y) my = 1;
        else if (cam_y < seen_y) my = 2;
        if (after_blit) {
            after_blit = 0;
        } else {
            feed_scroll(mx, my);
        }
    }
    seen_x = cam_x;
    seen_y = cam_y;
}

static void update_sprite(void);
static void refresh_status(void);
void bomb_status(void);

/* Call at raster 250. The matrix flip lands in the border. Colors are
   filled with interrupts on, so the title split can still fire. */
static void present_scroll(void)
{
    unsigned char v;
    unsigned char* colors;
    /* Raster is 250 here, so a clock tick lands in the lower border. */
    refresh_status();
    publish_scroll();
    if (flip_pending) {
        SEI();
        showing_b ^= 1;
        v = *(volatile unsigned char*)0xD018;
        *(volatile unsigned char*)0xD018 = (unsigned char)((v & 0x0F) | (showing_b ? 0xE0 : 0x10));
        flip_pending = 0;
        CLI();
        colors = vis_color();
        update_sprite();
        blit_colors(colors + (unsigned int)TITLE_ROWS * 40 + PLAY_COL0);
        after_blit = 1;
    } else {
        update_sprite();
    }
}

#pragma code-name(push, "BOMB")
static unsigned char solid(unsigned short px, unsigned short py)
{
    unsigned char tile;
    if (px >= MAP_PX_W || py >= MAP_PX_H) {
        return 1;
    }
    tile = map[py >> 3][px >> 3];
    return (unsigned char)(tile == WALL || tile == OUTER);
}
#pragma code-name(pop)

static unsigned char blocked(unsigned short x, unsigned short y)
{
    unsigned char i;
    unsigned char j;
    for (j = 0; j < 3; j++) {
        for (i = 0; i < 2; i++) {
            if (solid((unsigned short)(x + hit_x[i]), (unsigned short)(y + hit_y[j]))) {
                return 1;
            }
        }
    }
    return 0;
}

static unsigned char key_down(unsigned char colmask, unsigned char rowbit,
                              unsigned char held)
{
    volatile unsigned char* cia1;
    cia1 = (unsigned char*)0xDC00;
    cia1[0] = colmask;
    /* A stick in port 1 pulls a keyboard row low in every column.
       Those bits are in `held`; treat them as released. */
    return ((cia1[1] | held) & rowbit) == 0;
}

static unsigned char read_input(void)
{
    volatile unsigned char* cia1;
    unsigned char in;
    unsigned char joy1;
    unsigned char joy2;
    unsigned char shift;
    unsigned char down;
    unsigned char right;

    cia1 = (unsigned char*)0xDC00;
    in = 0;
    SEI();

    /* No column selected, so port B is the joystick in port 1. */
    cia1[2] = 0xFF;
    cia1[0] = 0xFF;
    joy1 = (~cia1[1]) & 0x0F;

    /* Port 2 shares the column pins, which only read the stick as inputs. */
    cia1[2] = 0x00;
    joy2 = (~cia1[0]) & 0x0F;
    cia1[2] = 0xFF;
    cia1[0] = 0xFF;

    /* Port A selects the column, port B is the row. W and D share
       equal indices; A, S, and the cursors do not, so the two axes
       must not be swapped. */
    if (key_down(0xFD, 0x02, joy1)) in |= IN_UP;      /* W  col 1 row 1 */
    if (key_down(0xFD, 0x04, joy1)) in |= IN_LEFT;    /* A  col 1 row 2 */
    if (key_down(0xFD, 0x20, joy1)) in |= IN_DOWN;    /* S  col 1 row 5 */
    if (key_down(0xFB, 0x04, joy1)) in |= IN_RIGHT;   /* D  col 2 row 2 */

    /* Cursor down / right. Shift flips them to up / left. */
    shift = key_down(0xFD, 0x80, joy1) || key_down(0xBF, 0x10, joy1);
    down = key_down(0xFE, 0x80, joy1);
    right = key_down(0xFE, 0x04, joy1);
    if (down) {
        in |= shift ? IN_UP : IN_DOWN;
    }
    if (right) {
        in |= shift ? IN_LEFT : IN_RIGHT;
    }

    cia1[0] = 0xFF;
    in |= joy1;
    in |= joy2;
    CLI();
    return in;
}

static void move_player(unsigned char in)
{
    unsigned char step;
    unsigned char moved;
    moved = 0;
    if (in & IN_LEFT) {
        for (step = SPEED; step > 0; step--) {
            if (player_x >= step && !blocked((unsigned short)(player_x - step), player_y)) {
                player_x = (unsigned short)(player_x - step);
                facing = 1;
                player_dir = 1;
                moved = 1;
                break;
            }
        }
    } else if (in & IN_RIGHT) {
        for (step = SPEED; step > 0; step--) {
            if (!blocked((unsigned short)(player_x + step), player_y)) {
                player_x = (unsigned short)(player_x + step);
                facing = 0;
                player_dir = 0;
                moved = 1;
                break;
            }
        }
    }
    if (in & IN_UP) {
        for (step = SPEED; step > 0; step--) {
            if (player_y >= step && !blocked(player_x, (unsigned short)(player_y - step))) {
                player_y = (unsigned short)(player_y - step);
                player_dir = 3;
                moved = 1;
                break;
            }
        }
    } else if (in & IN_DOWN) {
        for (step = SPEED; step > 0; step--) {
            if (!blocked(player_x, (unsigned short)(player_y + step))) {
                player_y = (unsigned short)(player_y + step);
                player_dir = 2;
                moved = 1;
                break;
            }
        }
    }
    if (moved) {
        walk_phase++;
        if ((walk_phase & 3) == 0) {
            sound_step();
        }
    }
}

static void advance_world(void);

/* Slide the camera to the target, one character (8 pixels) at a time.
   Input stays ignored for the whole slide. */
static void scroll_to(unsigned short target_x, unsigned short target_y)
{
    if (target_x == cam_x && target_y == cam_y) {
        return;
    }
    while (cam_x != target_x || cam_y != target_y) {
        if (cam_x + 8 <= target_x) {
            cam_x = (unsigned short)(cam_x + 8);
        } else if (cam_x >= target_x + 8) {
            cam_x = (unsigned short)(cam_x - 8);
        } else if (cam_y + 8 <= target_y) {
            cam_y = (unsigned short)(cam_y + 8);
        } else if (cam_y >= target_y + 8) {
            cam_y = (unsigned short)(cam_y - 8);
        } else {
            return;
        }
        prepare_scroll();
        wait_frame();
        present_scroll();
        advance_world();
        if (outcome) {
            return;
        }
    }
}

static unsigned short char_cap(unsigned short value, unsigned short limit)
{
    if (value > limit) {
        value = limit;
    }
    return (unsigned short)(value & 0xFFF8);
}

/* If the man is inside the edge band, slide the view and return only
   when every axis that needed it has finished. */
static void run_scroll(void)
{
    unsigned short target;
    unsigned short before;
    for (;;) {
        if (player_x + HIT_W + SCROLL_EDGE > cam_x + VIEW_W && cam_x < CAM_MAX_X) {
            before = cam_x;
            target = char_cap((unsigned short)(cam_x + SCROLL_AMOUNT), CAM_MAX_X);
            if (target > player_x) {
                target = (unsigned short)(player_x & 0xFFF8);
            }
            scroll_to(target, cam_y);
            if (cam_x == before) {
                return;
            }
        } else if (cam_x > 0 && player_x < cam_x + SCROLL_EDGE) {
            before = cam_x;
            if (cam_x > SCROLL_AMOUNT) {
                target = (unsigned short)(cam_x - SCROLL_AMOUNT);
            } else {
                target = 0;
            }
            scroll_to(target, cam_y);
            if (cam_x == before) {
                return;
            }
        } else if (player_y + HIT_H + SCROLL_EDGE > cam_y + VIEW_H && cam_y < CAM_MAX_Y) {
            before = cam_y;
            target = char_cap((unsigned short)(cam_y + SCROLL_AMOUNT), CAM_MAX_Y);
            if (target > player_y) {
                target = (unsigned short)(player_y & 0xFFF8);
            }
            scroll_to(cam_x, target);
            if (cam_y == before) {
                return;
            }
        } else if (cam_y > 0 && player_y < cam_y + SCROLL_EDGE) {
            before = cam_y;
            if (cam_y > SCROLL_AMOUNT) {
                target = (unsigned short)(cam_y - SCROLL_AMOUNT);
            } else {
                target = 0;
            }
            scroll_to(cam_x, target);
            if (cam_y == before) {
                return;
            }
        } else {
            return;
        }
    }
}

static void update_sprite(void)
{
    unsigned char frame;
    frame = (unsigned char)((facing << 1) | ((walk_phase >> 2) & 1));
    SPRITE_PTR_A[0] = (unsigned char)(SPRITE_BLOCK + frame);
    SPRITE_PTR_B[0] = (unsigned char)(SPRITE_BLOCK + frame);
    place_sprites();
}

static unsigned char shown_life;
static unsigned int shown_time;
static unsigned char shown_gems;
static unsigned char shown_outcome;

/* Column is constant at the call sites that run during play, so this
   stays a handful of stores. The full bar is not rebuilt each frame. */
static void status_at(unsigned char col, unsigned char sc, unsigned char ink)
{
    SCREEN_A[col] = sc;
    SCREEN_B[col] = sc;
    color_a[col] = ink;
    color_b[col] = ink;
    COLOR_RAM[col] = ink;
}

static void status_clock(void)
{
    unsigned char min;
    unsigned char sec;
    unsigned char a;
    unsigned char b;
    unsigned char c;
    min = (unsigned char)(time_left / 60);
    sec = (unsigned char)(time_left % 60);
    a = (unsigned char)(48 + min / 10);
    b = (unsigned char)(48 + min % 10);
    c = (unsigned char)(48 + sec / 10);
    SCREEN_A[5] = a;
    SCREEN_B[5] = a;
    COLOR_RAM[5] = COLOR_WHITE;
    SCREEN_A[6] = b;
    SCREEN_B[6] = b;
    COLOR_RAM[6] = COLOR_WHITE;
    SCREEN_A[7] = 58;
    SCREEN_B[7] = 58;
    COLOR_RAM[7] = COLOR_WHITE;
    SCREEN_A[8] = c;
    SCREEN_B[8] = c;
    COLOR_RAM[8] = COLOR_WHITE;
    c = (unsigned char)(48 + sec % 10);
    SCREEN_A[9] = c;
    SCREEN_B[9] = c;
    COLOR_RAM[9] = COLOR_WHITE;
}

static void status_hearts(void)
{
    unsigned char i;
    for (i = 0; i < LIFE_MAX; i++) {
        if (i < life) {
            status_at((unsigned char)(30 + i), HEART, COLOR_RED);
        } else {
            status_at((unsigned char)(30 + i), 32, COLOR_BLACK);
        }
    }
}

/* Diamond glyph plus the count still to collect, just right of the clock. */
static void status_gems(void)
{
    unsigned char tens;
    unsigned char ones;
    tens = (unsigned char)(pickups_left / 10);
    ones = (unsigned char)(pickups_left % 10);
    status_at(11, DIAMOND, COLOR_WHITE);
    if (tens) {
        status_at(12, (unsigned char)(48 + tens), COLOR_WHITE);
    } else {
        status_at(12, 32, COLOR_BLACK);
    }
    status_at(13, (unsigned char)(48 + ones), COLOR_WHITE);
}

static void draw_status(void)
{
    unsigned char col;
    const char* msg;
    blank_status();
    if (outcome == 1) {
        msg = "YOU WIN";
    } else if (outcome == 2 && life == 0) {
        msg = "CAUGHT";
    } else if (outcome == 2) {
        msg = "TIME UP";
    } else {
        msg = "TIME ";
    }
    col = 0;
    while (*msg && col < 40) {
        if (*msg >= 'A' && *msg <= 'Z') {
            status_at(col, (unsigned char)(*msg - 'A' + 1), COLOR_WHITE);
        }
        msg++;
        col++;
    }
    if (!outcome) {
        status_clock();
        status_gems();
        status_hearts();
        bomb_status();
    }
    shown_life = life;
    shown_time = time_left;
    shown_gems = pickups_left;
    shown_outcome = outcome;
}

static void refresh_status(void)
{
    if (shown_outcome != outcome) {
        draw_status();
        return;
    }
    if (outcome) {
        return;
    }
    if (shown_time != time_left) {
        status_clock();
        shown_time = time_left;
    }
    if (shown_life != life) {
        status_hearts();
        shown_life = life;
    }
    if (shown_gems != pickups_left) {
        status_gems();
        shown_gems = pickups_left;
    }
}

static void erase_map_tile(unsigned char mx, unsigned char my)
{
    int row;
    unsigned char col;
    unsigned int off;
    map[my][mx] = FLOOR;
    if (seam_y == 0xFF) {
        row = (int)TITLE_ROWS + 1 + (int)my;
    } else {
        row = (int)TITLE_ROWS + (int)my - (int)seam_y;
    }
    if (mx < origin_x) {
        return;
    }
    col = (unsigned char)(mx - origin_x);
    if (col >= PLAY_COLS) {
        return;
    }
    if (row < TITLE_ROWS || row >= TITLE_ROWS + PLAY_ROWS) {
        return;
    }
    off = (unsigned int)row * 40 + col;
    SCREEN_A[off] = FLOOR;
    SCREEN_B[off] = FLOOR;
    color_a[off] = COLOR_GRAY1;
    color_b[off] = COLOR_GRAY1;
    COLOR_RAM[off] = COLOR_GRAY1;
}

static void take_pickups(void)
{
    unsigned char xs[2];
    unsigned char ys[3];
    unsigned char i;
    unsigned char j;
    unsigned char tx;
    unsigned char ty;
    xs[0] = (unsigned char)(player_x >> 3);
    xs[1] = (unsigned char)((player_x + HIT_W - 1) >> 3);
    ys[0] = (unsigned char)(player_y >> 3);
    ys[1] = (unsigned char)((player_y + 6) >> 3);
    ys[2] = (unsigned char)((player_y + HIT_H - 1) >> 3);
    for (j = 0; j < 3; j++) {
        for (i = 0; i < 2; i++) {
            tx = xs[i];
            ty = ys[j];
            if (tx >= MAP_W || ty >= MAP_H) {
                continue;
            }
            if (map[ty][tx] == DIAMOND) {
                erase_map_tile(tx, ty);
                if (pickups_left) {
                    pickups_left--;
                }
                note_gem(tx, ty);
            }
        }
    }
}

static unsigned char on_door(void)
{
    unsigned char xs[2];
    unsigned char ys[2];
    unsigned char i;
    unsigned char j;
    xs[0] = (unsigned char)(player_x >> 3);
    xs[1] = (unsigned char)((player_x + HIT_W - 1) >> 3);
    ys[0] = (unsigned char)(player_y >> 3);
    ys[1] = (unsigned char)((player_y + HIT_H - 1) >> 3);
    for (j = 0; j < 2; j++) {
        for (i = 0; i < 2; i++) {
            if (xs[i] < MAP_W && ys[j] < MAP_H && map[ys[j]][xs[i]] == DOOR) {
                return 1;
            }
        }
    }
    return 0;
}

static void advance_world(void)
{
    if (outcome) {
        return;
    }
    chase_ghosts();
    sound_tick();
    frame_div++;
    if (frame_div >= 50) {
        frame_div = 0;
        if (time_left) {
            time_left--;
        }
        if (time_left == 0) {
            outcome = 2;
        }
    }
    update_sprite();
}

static unsigned char find_floor(unsigned char x0, unsigned char y0,
                               unsigned char x1, unsigned char y1,
                               unsigned char* ox, unsigned char* oy)
{
    unsigned char tries;
    unsigned char x;
    unsigned char y;
    for (tries = 0; tries < 80; tries++) {
        x = (unsigned char)(x0 + rand() % (unsigned char)(x1 - x0));
        y = (unsigned char)(y0 + rand() % (unsigned char)(y1 - y0));
        if (map[y][x] == FLOOR) {
            *ox = x;
            *oy = y;
            return 1;
        }
    }
    for (y = y0; y < y1; y++) {
        for (x = x0; x < x1; x++) {
            if (map[y][x] == FLOOR) {
                *ox = x;
                *oy = y;
                return 1;
            }
        }
    }
    return 0;
}

static unsigned char hearts_close(unsigned char x, unsigned char y,
                                 const unsigned char* hx, const unsigned char* hy,
                                 unsigned char n)
{
    unsigned char i;
    int dx;
    int dy;
    for (i = 0; i < n; i++) {
        dx = (int)x - (int)hx[i];
        dy = (int)y - (int)hy[i];
        if (dx < 0) {
            dx = -dx;
        }
        if (dy < 0) {
            dy = -dy;
        }
        if (dx < 18 && dy < 18) {
            return 1;
        }
    }
    return 0;
}

static void place_door(void)
{
    unsigned char x;
    unsigned char y;
    /* Last cell (38, 23) is open: its 3x3 floor starts at (153, 93). */
    for (y = 93; y < 96; y++) {
        for (x = 153; x < 156; x++) {
            map[y][x] = DOOR;
        }
    }
}

static void place_diamonds(void)
{
    unsigned char n;
    unsigned char k;
    unsigned char x0;
    unsigned char y0;
    unsigned char x;
    unsigned char y;
    unsigned char placed;
    unsigned char hx[PICKUPS];
    unsigned char hy[PICKUPS];
    placed = 0;
    for (n = 0; n < PICKUPS; n++) {
        gem_x[n] = 0xFF;
    }
    for (n = 0; n < PICKUPS; n++) {
        x0 = (unsigned char)((n % 5) * 32);
        y0 = (unsigned char)((n / 5) * 50);
        x = x0;
        y = y0;
        for (k = 0; k < 40; k++) {
            x = (unsigned char)(x0 + rand() % 32);
            y = (unsigned char)(y0 + rand() % 50);
            if (x < 8 && y < 8) {
                continue;
            }
            if (map[y][x] == FLOOR && !hearts_close(x, y, hx, hy, placed)) {
                break;
            }
        }
        if (k == 40) {
            for (y = y0; y < (unsigned char)(y0 + 50); y++) {
                for (x = x0; x < (unsigned char)(x0 + 32); x++) {
                    if (map[y][x] == FLOOR && !(x < 8 && y < 8)
                        && !hearts_close(x, y, hx, hy, placed)) {
                        k = 41;
                        break;
                    }
                }
                if (k == 41) {
                    break;
                }
            }
        }
        if (k != 40 && map[y][x] == FLOOR) {
            map[y][x] = DIAMOND;
            hx[placed] = x;
            hy[placed] = y;
            gem_x[placed] = x;
            gem_y[placed] = y;
            placed++;
        }
    }
    pickups_left = placed;
}

static void place_ghosts(void)
{
    unsigned char i;
    unsigned char x;
    unsigned char y;
    static const unsigned char box[GHOSTS][4] = {
        { 100, 4, 150, 40 },
        { 8, 55, 50, 90 },
        { 110, 55, 150, 94 },
        { 40, 20, 90, 48 }
    };
    for (i = 0; i < GHOSTS; i++) {
        x = 16;
        y = 16;
        find_floor(box[i][0], box[i][1], box[i][2], box[i][3], &x, &y);
        ghost_x[i] = (unsigned short)(x * 8 + 4);
        ghost_y[i] = (unsigned short)(y * 8 + 4);
        ghost_head[i] = i;
    }
}

static void carve_cell(unsigned char cx, unsigned char cy)
{
    unsigned char x;
    unsigned char y;
    unsigned char dx;
    unsigned char dy;
    x = (unsigned char)(1 + cx * STEP);
    y = (unsigned char)(1 + cy * STEP);
    for (dy = 0; dy < PATH; dy++) {
        for (dx = 0; dx < PATH; dx++) {
            map[y + dy][x + dx] = FLOOR;
        }
    }
}

static unsigned char cell_open(unsigned char cx, unsigned char cy)
{
    return map[1 + cy * STEP][1 + cx * STEP] == FLOOR;
}

static void open_between(unsigned char cx, unsigned char cy, unsigned char dir)
{
    unsigned char x;
    unsigned char y;
    unsigned char i;
    x = (unsigned char)(1 + cx * STEP);
    y = (unsigned char)(1 + cy * STEP);
    if (dir == 0) {
        for (i = 0; i < PATH; i++) {
            map[y - 1][x + i] = FLOOR;
        }
    } else if (dir == 1) {
        for (i = 0; i < PATH; i++) {
            map[y + PATH][x + i] = FLOOR;
        }
    } else if (dir == 2) {
        for (i = 0; i < PATH; i++) {
            map[y + i][x - 1] = FLOOR;
        }
    } else {
        for (i = 0; i < PATH; i++) {
            map[y + i][x + PATH] = FLOOR;
        }
    }
}

static void generate_maze(void)
{
    unsigned int sp;
    memset(map, WALL, sizeof(map));
#ifdef OPEN_FIELD
    {
        unsigned char x;
        unsigned char y;
        for (y = 1; y < MAP_H - 1; y++) {
            for (x = 1; x < MAP_W - 1; x++) {
                map[y][x] = FLOOR;
            }
        }
        /* Walkable markers so scrolling is easy to see in a test build. */
        for (x = 0; x < MAP_W; x += 10) {
            for (y = 1; y < MAP_H - 1; y++) {
                if (x > 0 && x < MAP_W - 1) {
                    map[y][x] = 46;
                }
            }
        }
        for (y = 0; y < MAP_H; y += 8) {
            for (x = 1; x < MAP_W - 1; x++) {
                if (y > 0 && y < MAP_H - 1 && map[y][x] != 46) {
                    map[y][x] = 42;
                }
            }
        }
        return;
    }
#else
    carve_cell(0, 0);
    stack_x[0] = 0;
    stack_y[0] = 0;
    sp = 1;
    while (sp) {
        unsigned char cx;
        unsigned char cy;
        unsigned char n;
        unsigned char opts[4];
        unsigned char dir;
        unsigned char pick;
        cx = stack_x[sp - 1];
        cy = stack_y[sp - 1];
        n = 0;
        for (dir = 0; dir < 4; dir++) {
            int tx;
            int ty;
            tx = (int)cx + dir_x[dir];
            ty = (int)cy + dir_y[dir];
            if (tx < 0 || ty < 0 || tx >= CELLS_X || ty >= CELLS_Y) {
                continue;
            }
            if (cell_open((unsigned char)tx, (unsigned char)ty)) {
                continue;
            }
            opts[n++] = dir;
        }
        spark_border();
        if (n == 0) {
            sp--;
            continue;
        }
        pick = opts[rand() % n];
        open_between(cx, cy, pick);
        cx = (unsigned char)(cx + dir_x[pick]);
        cy = (unsigned char)(cy + dir_y[pick]);
        carve_cell(cx, cy);
        stack_x[sp] = cx;
        stack_y[sp] = cy;
        sp++;
    }
#endif
}

static void setup_video(void)
{
    *(volatile unsigned char*)0xD018 = 0x15;   /* screen $0400, charset $1000 */
    *(volatile unsigned char*)0xD015 = 0x3F;   /* player, ghosts, diamond map */
    SPRITE_PTR_A[1] = GHOST_BLOCK;
    SPRITE_PTR_B[1] = GHOST_BLOCK;
    SPRITE_PTR_A[2] = GHOST_BLOCK;
    SPRITE_PTR_B[2] = GHOST_BLOCK;
    SPRITE_PTR_A[3] = GHOST_BLOCK;
    SPRITE_PTR_B[3] = GHOST_BLOCK;
    SPRITE_PTR_A[4] = GHOST_BLOCK;
    SPRITE_PTR_B[4] = GHOST_BLOCK;
    *(volatile unsigned char*)0xD01C = 0x00;   /* hires */
    *(volatile unsigned char*)0xD017 = 0x00;
    *(volatile unsigned char*)0xD01D = 0x00;
    *(volatile unsigned char*)0xD01B = 0x00;   /* sprites in front of text */
    *(volatile unsigned char*)0xD027 = COLOR_YELLOW;
    *(volatile unsigned char*)0xD028 = ghost_ink[0];
    *(volatile unsigned char*)0xD029 = ghost_ink[1];
    *(volatile unsigned char*)0xD02A = ghost_ink[2];
    *(volatile unsigned char*)0xD02B = ghost_ink[3];
}

#ifdef AUTO_FRAMES
static unsigned int auto_frames;

static unsigned char auto_input(void)
{
    if (auto_frames < 400) return IN_RIGHT;
    if (auto_frames < 800) return IN_DOWN;
    if (auto_frames < 1000) return IN_LEFT;
    if (auto_frames < 1200) return IN_UP;
    return IN_RIGHT;
}
#endif

#pragma code-name(push, "BOMB")

static void paint_shell(void)
{
    unsigned char x;
    unsigned char y;
    unsigned char* edge;
    edge = map[0];
    for (x = 0; x < MAP_W; x++) {
        edge[x] = OUTER;
    }
    edge = map[MAP_H - 1];
    for (x = 0; x < MAP_W; x++) {
        edge[x] = OUTER;
    }
    for (y = 0; y < MAP_H; y++) {
        map[y][0] = OUTER;
        map[y][MAP_W - 1] = OUTER;
    }
}

void bomb_status(void)
{
    status_at(16, BOMB_BODY, COLOR_WHITE);
    status_at(17, (unsigned char)(48 + bombs_left), COLOR_WHITE);
}

static void screen_off(void)
{
    screen_blank = 1;
    *(volatile unsigned char*)0xD011 = 0x0B;
}

static void screen_on(void)
{
    screen_blank = 0;
    *(volatile unsigned char*)0xD011 = 0x1B;
    *(volatile unsigned char*)0xD020 = COLOR_BLACK;
    *(volatile unsigned char*)0xD021 = COLOR_BLACK;
}

static void put_cell(unsigned int off, unsigned char sc, unsigned char ink)
{
    SCREEN_A[off] = sc;
    SCREEN_B[off] = sc;
    color_a[off] = ink;
    color_b[off] = ink;
    COLOR_RAM[off] = ink;
}

static void clear_screen(void)
{
    memset(SCREEN_A, 32, 1000);
    memset(SCREEN_B, 32, 1000);
    memset(color_a, COLOR_BLACK, 1000);
    memset(color_b, COLOR_BLACK, 1000);
    memset(COLOR_RAM, COLOR_BLACK, 1000);
}

/* Lowercase charset: a-z are screen codes 1-26, A-Z are 65-90. */
static void write_mixed(unsigned char row, unsigned char col,
                         const char* text, unsigned char ink)
{
    unsigned int off;
    unsigned char sc;
    char ch;

    off = (unsigned int)row * 40 + col;
    while (*text) {
        ch = *text++;
        if (ch >= 'a' && ch <= 'z') {
            sc = (unsigned char)(ch - 'a' + 1);
        } else if (ch >= 'A' && ch <= 'Z') {
            sc = (unsigned char)(ch - 'A' + 65);
        } else {
            sc = (unsigned char)ch;
        }
        put_cell(off, sc, ink);
        off++;
    }
}

/* 4x5 letters. Bit 3 is the left column. MAZE then 2046. */
static const unsigned char title_bits[8][5] = {
    { 0x09, 0x0D, 0x0B, 0x09, 0x09 },
    { 0x06, 0x09, 0x0F, 0x09, 0x09 },
    { 0x0F, 0x01, 0x02, 0x04, 0x0F },
    { 0x0F, 0x08, 0x0E, 0x08, 0x0F },
    { 0x0E, 0x01, 0x06, 0x08, 0x0F },
    { 0x06, 0x09, 0x09, 0x09, 0x06 },
    { 0x09, 0x09, 0x0F, 0x01, 0x01 },
    { 0x06, 0x08, 0x0E, 0x09, 0x06 }
};
static const unsigned char title_x[8] = { 0, 5, 10, 15, 21, 26, 31, 36 };

static void show_title(void)
{
    unsigned char g;
    unsigned char row;
    unsigned char col;
    unsigned char bits;
    unsigned int off;
    static const unsigned char ink[8] = {
        COLOR_CYAN, COLOR_CYAN, COLOR_CYAN, COLOR_CYAN,
        COLOR_YELLOW, COLOR_YELLOW, COLOR_YELLOW, COLOR_YELLOW
    };

    sprites_on = 0;
    play_phase = 0;
    play_xreg = 0xC8;
    *(volatile unsigned char*)0xD018 = 0x17;
    screen_off();
    clear_screen();
    for (g = 0; g < 8; g++) {
        for (row = 0; row < 5; row++) {
            bits = title_bits[g][row];
            for (col = 0; col < 4; col++) {
                if (bits & (unsigned char)(0x08 >> col)) {
                    off = (unsigned int)(4 + row) * 40 + title_x[g] + col;
                    put_cell(off, 160, ink[g]);
                }
            }
        }
    }
    write_mixed(11, 10, "(c) 1983 Evil Studio", COLOR_LIGHTGREEN);
    write_mixed(15, 10, "Press fire to start", COLOR_WHITE);
    screen_on();
}

static void wait_start(void)
{
    while (button_down()) {
    }
    while (!button_down()) {
    }
}

static void show_game_over(void)
{
    unsigned char i;
    unsigned int off;
    static const unsigned char msg[9] = { 7, 1, 13, 5, 32, 15, 22, 5, 18 };

    sprites_on = 0;
    play_phase = 0;
    play_xreg = 0xC8;
    *(volatile unsigned char*)0xD018 = 0x15;
    screen_off();
    clear_screen();
    off = 12 * 40 + 15;
    for (i = 0; i < 9; i++) {
        put_cell((unsigned int)(off + i), msg[i], COLOR_WHITE);
    }
    screen_on();
    for (i = 0; i < 200; i++) {
        wait_frame();
    }
}

#pragma code-name(pop)

int main(void)
{
    /* Hide the cursor. The title is drawn before the picture comes on. */
    POKE(0xCC, 1);

#ifdef AUTO_SEED
    srand(AUTO_SEED);
#else
    srand((unsigned)PEEK(0xDC04) ^ ((unsigned)PEEK(0xD012) << 8) ^ (unsigned)PEEK(0xDC05));
#endif
    show_title();
    install_irq();

    for (;;) {
    wait_start();
    screen_off();
    generate_maze();
    place_door();
    paint_shell();
    place_diamonds();
    place_ghosts();
    life = LIFE_MAX;
    bombs_left = BOMB_SLOTS;
    time_left = TIME_START;
    outcome = 0;
    hurt_cool = 0;
    frame_div = 0;
    bomb_reset();

    /* First corridor of cell (0, 0) is pixels x=8..31, y=8..31. */
    player_x = 16;
    player_y = 14;
    cam_x = 0;
    cam_y = 0;
    origin_x = 0;
    seam_y = 0xFF;
    facing = 0;
    walk_phase = 0;
    player_dir = 0;
    door_run = 0;

    showing_b = 0;
    flip_pending = 0;
    after_blit = 0;
    pred_x = 0;
    pred_y = 0;
    pred_at = 0;
    pred_ready = 0;
    seen_x = 0;
    seen_y = 0;
    redraw_view(SCREEN_A, color_a);
    memcpy(SCREEN_B, SCREEN_A, 1000);
    memcpy(color_b, color_a, 1000);
    memcpy(COLOR_RAM, color_a, 1000);
    setup_video();
    sound_init();
    publish_scroll();
    draw_status();
    update_sprite();
    while (button_down()) {
        spark_border();
    }
    sprites_on = 1;
    screen_on();

    while (!outcome) {
        unsigned char in;
        if (door_run) {
            if (door_tick()) {
                outcome = 1;
            }
            wait_frame();
            if (!outcome) {
                refresh_status();
            }
            continue;
        }
#ifdef AUTO_FRAMES
        in = auto_input();
#else
        in = read_input();
#endif
        move_player(in);
        take_pickups();
        if (pickups_left == 0 && on_door()) {
            door_run = 1;
            sound_door();
        }
        advance_world();
        wait_frame();
        /* Leave the maze up when he dies. The song plays over it. */
        if (!outcome) {
            refresh_status();
            run_scroll();
        }
#ifdef AUTO_FRAMES
        auto_frames++;
        if (auto_frames >= AUTO_FRAMES) {
#ifdef FRAME_MARK
            {
                unsigned char b;
                unsigned int worst;
                worst = cyc_max;
                for (b = 0; b < 16; b++) {
                    unsigned char ch;
                    ch = (worst & (unsigned int)(0x8000 >> b)) ? 160 : 32;
                    SCREEN_A[2 + b] = ch;
                    SCREEN_B[2 + b] = ch;
                    COLOR_RAM[2 + b] = 1;
                }
                worst = cyc_min;
                for (b = 0; b < 16; b++) {
                    unsigned char ch;
                    ch = (worst & (unsigned int)(0x8000 >> b)) ? 160 : 32;
                    SCREEN_A[40 + 2 + b] = ch;
                    SCREEN_B[40 + 2 + b] = ch;
                    COLOR_RAM[40 + 2 + b] = 7;
                }
                for (b = 0; b < 8; b++) {
                    unsigned char ch;
                    ch = (cyc_over & (unsigned char)(0x80 >> b)) ? 160 : 32;
                    SCREEN_A[18 + b] = ch;
                    SCREEN_B[18 + b] = ch;
                    COLOR_RAM[18 + b] = 5;
                }
                *(volatile unsigned char*)0xD020 = (cyc_max > 19656) ? 2 : 5;
            }
#endif
            /* One more frame so the cycle-count row is scanned before the jam. */
            wait_frame();
            wait_frame();
            debug_jam();
        }
#endif
    }
    if (outcome == 2 && life == 0) {
        status_hearts();
        sound_sad();
        show_game_over();
        show_title();
        continue;
    }
    break;
    }
    wait_frame();
    refresh_status();
    if (outcome == 1) {
        *(volatile unsigned char*)0xD020 = COLOR_GREEN;
    } else if (outcome == 2) {
        *(volatile unsigned char*)0xD020 = COLOR_RED;
    }
    while (1) {
        wait_frame();
    }
    return 0;
}
