; Ghost chase and sprite placement.
;
; Each ghost hunts a different spot: the player, a point ahead of him,
; a point off to the side, or a point behind him. One pixel per call
; in the corridors (half the player's speed) and every other call
; through walls when that spot is far. If the step toward the spot is
; blocked, the ghost walks its own heading and turns when that is
; blocked too, so the four of them leave a junction different ways.

.importzp ptr1, tmp1, tmp2

.import _map
.import _player_x, _player_y, _player_dir, _cam_x, _cam_y
.import _ghost_x, _ghost_y
.import _life, _hurt_cool, _frame_div, _outcome
.import _sound_siren
.import _plot_minimap
.import _place_foes

.export _chase_ghosts
.export _place_sprites
.export _blank_status
.export _ghost_head
.export gindex
.export box_wall
.export origin_ok
.export pixel_wall
.export ghost_on_screen
.export tx
.export ty
.export px
.export py
.export gx
.export gy
.export msb
.import _ghost_hold
.import _kiss_at
.import _girl_love
.import _girl_pair
.import _ghost_stun

.segment "BSS"

gx:     .res 2
gy:     .res 2
tx:     .res 2
ty:     .res 2
px:     .res 2
py:     .res 2
dx:     .res 2
dy:     .res 2
ax:     .res 2
ay:     .res 2
stepx:  .res 1
stepy:  .res 1
sxk:    .res 1
syk:    .res 1
through: .res 1
gslot:  .res 1
gindex: .res 1
row:    .res 1
colb:   .res 1
bitm:   .res 1
msb:    .res 1
aimx:   .res 2
aimy:   .res 2
_ghost_head: .res 4

.segment "CODE"

; row*160 + colb + map. Carry set when that cell is a wall.
cell_byte:
        lda #0
        sta ptr1+1
        lda row
        ldx #5
@m32:   asl
        rol ptr1+1
        dex
        bne @m32
        sta ptr1
        lda row
        sta tmp1
        lda #0
        sta tmp2
        ldx #7
@m128:  asl tmp1
        rol tmp2
        dex
        bne @m128
        clc
        lda ptr1
        adc tmp1
        sta ptr1
        lda ptr1+1
        adc tmp2
        sta ptr1+1
        clc
        lda ptr1
        adc colb
        sta ptr1
        bcc @col
        inc ptr1+1
@col:   clc
        lda ptr1
        adc #<_map
        sta ptr1
        lda ptr1+1
        adc #>_map
        sta ptr1+1
        ldy #0
        lda (ptr1),y
        cmp #160
        beq @wall
        cmp #161
        beq @wall
        clc
        rts
@wall:  sec
        rts

; Carry set when the pixel in px/py is outside the map or on a wall.
pixel_wall:
        lda px+1
        cmp #5                  ; x >= 1280
        bcs @yes
        lda py+1
        cmp #3
        bcc @inside
        bne @yes
        lda py
        cmp #$20                ; y >= 800
        bcs @yes
@inside:
        lda py
        sta row
        lda py+1
        lsr
        ror row
        lsr
        ror row
        lsr
        ror row
        lda px
        sta colb
        lda px+1
        lsr
        ror colb
        lsr
        ror colb
        lsr
        ror colb
        jmp cell_byte
@yes:   sec
        rts

; Six samples of an 8x12 box at tx/ty. Carry set if any sample hits a wall.
box_wall:
        ldx #0
@p:     txa
        pha
        lda tx
        clc
        adc xoff,x
        sta px
        lda tx+1
        adc #0
        sta px+1
        lda ty
        clc
        adc yoff,x
        sta py
        lda ty+1
        adc #0
        sta py+1
        jsr pixel_wall
        pla
        tax
        bcs @hit
        inx
        cpx #6
        bcc @p
        clc
        rts
@hit:   sec
        rts

xoff:   .byte 0, 7, 0, 7, 0, 7
yoff:   .byte 0, 0, 6, 6, 11, 11

; Carry set when the 8x12 box at tx/ty would leave the map.
origin_ok:
        lda tx+1
        bmi @bad
        cmp #4
        bcc @xok
        bne @bad
        lda tx
        cmp #$F9                ; x > 1272
        bcs @bad
@xok:   lda ty+1
        bmi @bad
        cmp #3
        bcc @good
        bne @bad
        lda ty
        cmp #$15                ; y > 788
        bcs @bad
@good:  clc
        rts
@bad:   sec
        rts

; stepx/stepy are -1, 0 or +1. Carry set when the ghost actually moved.
apply_step:
        lda stepx
        bmi @xneg
        lda gx
        clc
        adc stepx
        sta tx
        lda gx+1
        adc #0
        sta tx+1
        jmp @y
@xneg:  lda gx
        clc
        adc stepx
        sta tx
        lda gx+1
        adc #$FF
        sta tx+1
@y:     lda stepy
        bmi @yneg
        lda gy
        clc
        adc stepy
        sta ty
        lda gy+1
        adc #0
        sta ty+1
        rts
@yneg:  lda gy
        clc
        adc stepy
        sta ty
        lda gy+1
        adc #$FF
        sta ty+1
        rts

try_move:
        jsr apply_step
        jsr origin_ok
        bcs @no
        lda through
        bne @yes
        jsr box_wall
        bcs @no
@yes:   ldx gslot
        lda tx
        sta _ghost_x,x
        lda tx+1
        sta _ghost_x+1,x
        lda ty
        sta _ghost_y,x
        lda ty+1
        sta _ghost_y+1,x
        sec
        rts
@no:    clc
        rts

; dx = aim - ghost, then the absolute value in ax.
delta_x:
        sec
        lda aimx
        sbc gx
        sta dx
        lda aimx+1
        sbc gx+1
        sta dx+1
        lda dx
        sta ax
        lda dx+1
        sta ax+1
        bpl @pos
        lda ax
        eor #$FF
        clc
        adc #1
        sta ax
        lda ax+1
        eor #$FF
        adc #0
        sta ax+1
@pos:   rts

delta_y:
        sec
        lda aimy
        sbc gy
        sta dy
        lda aimy+1
        sbc gy+1
        sta dy+1
        lda dy
        sta ay
        lda dy+1
        sta ay+1
        bpl @pos
        lda ay
        eor #$FF
        clc
        adc #1
        sta ay
        lda ay+1
        eor #$FF
        adc #0
        sta ay+1
@pos:   rts

; A = sign of dx (-1, 0, +1). dx+1 is the high byte.
sign_dx:
        lda dx+1
        bmi @neg
        ora dx
        beq @zero
        lda #1
        rts
@neg:   lda #$FF
        rts
@zero:  lda #0
        rts

sign_dy:
        lda dy+1
        bmi @neg
        ora dy
        beq @zero
        lda #1
        rts
@neg:   lda #$FF
        rts
@zero:  lda #0
        rts

aim_player:
        lda _player_x
        sta aimx
        lda _player_x+1
        sta aimx+1
        lda _player_y
        sta aimy
        lda _player_y+1
        sta aimy+1
        rts

; Kept above the second screen. The chase below is linked after the
; sprite pictures so drawing the screen cannot overwrite it.
.segment "CHASE"

; Add the signed byte in A to aimx and keep it inside the map.
add_aimx:
        sta tmp1
        clc
        lda aimx
        adc tmp1
        sta aimx
        lda tmp1
        and #$80
        beq @pl
        lda #$FF
        bne @hi
@pl:    lda #0
@hi:    adc aimx+1
        sta aimx+1
        bmi @lo
        cmp #4
        bcc @ok
        bne @top
        lda aimx
        cmp #$F8
        bcc @ok
@top:   lda #$F0
        sta aimx
        lda #$04
        sta aimx+1
@ok:    rts
@lo:    lda #0
        sta aimx
        sta aimx+1
        rts

add_aimy:
        sta tmp1
        clc
        lda aimy
        adc tmp1
        sta aimy
        lda tmp1
        and #$80
        beq @pl
        lda #$FF
        bne @hi
@pl:    lda #0
@hi:    adc aimy+1
        sta aimy+1
        bmi @lo
        cmp #3
        bcc @ok
        bne @top
        lda aimy
        cmp #$15
        bcc @ok
@top:   lda #$10
        sta aimy
        lda #$03
        sta aimy+1
@ok:    rts
@lo:    lda #0
        sta aimy
        sta aimy+1
        rts

; One dx,dy pair per facing (right, left, down, up). Ghost 1 steps
; ahead of the player, ghost 2 off to the side, ghost 3 behind him.
ahead:  .byte 48, 0, $D0, 0, 0, 48, 0, $D0
side:   .byte 0, 56, 0, $C8, $C8, 0, 56, 0
behind: .byte $C0, 0, 64, 0, 0, $C0, 0, 64

; ax/ay must still be the distance to the player. Ghost 0 is unchanged.
; Ghost 3 hunts directly once it is within 64 pixels.
adjust_aim:
        lda gindex
        beq @out
        cmp #3
        bne @go
        lda ax+1
        bne @go
        lda ay+1
        bne @go
        lda ax
        cmp #65
        bcs @go
        lda ay
        cmp #65
        bcc @out
@go:    lda gindex
        sec
        sbc #1
        asl
        asl
        asl
        sta tmp1
        lda _player_dir
        asl
        clc
        adc tmp1
        tay
        lda ahead,y
        sta sxk
        lda ahead+1,y
        sta syk
        lda sxk
        jsr add_aimx
        lda syk
        jmp add_aimy
@out:   rts

.segment "CODE"

; A = heading 0..3. Writes stepx/stepy.
set_step:
        cmp #1
        beq @left
        cmp #2
        beq @down
        cmp #3
        beq @up
        lda #1
        sta stepx
        lda #0
        sta stepy
        rts
@left:  lda #$FF
        sta stepx
        lda #0
        sta stepy
        rts
@down:  lda #0
        sta stepx
        lda #1
        sta stepy
        rts
@up:    lda #0
        sta stepx
        lda #$FF
        sta stepy
        rts

; One step along this ghost's heading. A blocked heading turns, and
; the two pairs turn opposite ways.
wander_step:
        ldy gindex
        lda _ghost_head,y
        jsr set_step
        jsr try_move
        bcs @out
        ldy gindex
        lda gindex
        cmp #2
        bcs @ccw
        lda _ghost_head,y
        clc
        adc #1
        and #3
        sta _ghost_head,y
        jmp @retry
@ccw:   lda _ghost_head,y
        sec
        sbc #1
        and #3
        sta _ghost_head,y
@retry: lda _ghost_head,y
        jsr set_step
        jsr try_move
@out:   rts

_chase_ghosts:
        lda #0
        sta gindex
        sta gslot
@ghost: jsr _ghost_hold
        bcc @live
        jmp @next
@live:  ldy gindex
        lda _girl_love
        beq @nolove
        lda _girl_pair
        cmp gindex
        bne @nolove
        jmp @next
@nolove:
        lda _ghost_stun,y
        beq @nostun
        sec
        sbc #1
        sta _ghost_stun,y
        jmp @next
@nostun:
        ldx gslot
        lda _ghost_x,x
        sta gx
        lda _ghost_x+1,x
        sta gx+1
        lda _ghost_y,x
        sta gy
        lda _ghost_y+1,x
        sta gy+1
        jsr aim_player
        jsr delta_x
        jsr delta_y
        lda #0
        sta through
        lda ax+1
        bne @far
        lda ax
        cmp #81
        bcs @far
        lda ay+1
        bne @far
        lda ay
        cmp #81
        bcc @near
@far:   lda #1
        sta through
@near:  lda gx
        sta px
        lda gx+1
        sta px+1
        lda gy
        sta py
        lda gy+1
        sta py+1
        jsr pixel_wall
        bcc @floor
        lda #1
        sta through
@floor: lda through
        beq @step
        lda _frame_div
        clc
        adc gindex
        and #1
        beq @step
        jmp @next
@step:  jsr adjust_aim
        jsr delta_x
        jsr delta_y
        jsr sign_dx
        sta stepx
        jsr sign_dy
        sta stepy
        lda stepx
        sta sxk
        lda stepy
        sta syk
        lda gindex
        cmp #3
        beq @xfirst
        cmp #2
        beq @yfirst
        cmp #1
        beq @minor
        lda ax+1
        cmp ay+1
        bcc @yfirst
        bne @xfirst
        lda ax
        cmp ay
        bcc @yfirst
        jmp @xfirst
@minor: lda ax+1
        cmp ay+1
        bcc @xfirst
        bne @yfirst
        lda ax
        cmp ay
        bcc @xfirst
        jmp @yfirst
@xfirst:
        lda sxk
        beq @only_y
        sta stepx
        lda #0
        sta stepy
        jsr try_move
        bcs @next
@only_y:
        lda syk
        beq @wander
        sta stepy
        lda #0
        sta stepx
        jsr try_move
        bcs @next
        jmp @wander
@yfirst:
        lda syk
        beq @only_x
        sta stepy
        lda #0
        sta stepx
        jsr try_move
        bcs @next
@only_x:
        lda sxk
        beq @wander
        sta stepx
        lda #0
        sta stepy
        jsr try_move
        bcs @next
@wander:
        lda sxk
        ora syk
        beq @next
        jsr wander_step
@next:  inc gindex
        lda gslot
        clc
        adc #2
        sta gslot
        cmp #8
        bcs @hurt
        jmp @ghost

@hurt:  ldx #0
        lda _hurt_cool
        beq @mark
        dec _hurt_cool
        ldx #1
@mark:  stx tmp1
@scan:  lda #0
        sta gslot
@hit:   lda _girl_love
        beq @hgo
        lda gslot
        lsr
        cmp _girl_pair
        bne @hgo
        jmp @miss
@hgo:   ldx gslot
        sec
        lda _ghost_x,x
        sbc _player_x
        sta dx
        lda _ghost_x+1,x
        sbc _player_x+1
        sta dx+1
        bpl @axp
        lda dx
        eor #$FF
        clc
        adc #1
        sta dx
        lda dx+1
        eor #$FF
        adc #0
        sta dx+1
@axp:   lda dx+1
        bne @miss
        lda dx
        cmp #8
        bcs @miss
        sec
        lda _ghost_y,x
        sbc _player_y
        sta dy
        lda _ghost_y+1,x
        sbc _player_y+1
        sta dy+1
        bpl @ayp
        lda dy
        eor #$FF
        clc
        adc #1
        sta dy
        lda dy+1
        eor #$FF
        adc #0
        sta dy+1
@ayp:   lda dy+1
        bne @miss
        lda dy
        cmp #10
        bcs @miss
        lda gslot
        lsr
        jsr _kiss_at
        lda tmp1
        bne @miss
        lda _life
        beq @dead
        sec
        sbc #1
        sta _life
        lda #40
        sta _hurt_cool
        jsr _sound_siren
        lda _life
        bne @done
@dead:  lda #2
        sta _outcome
@done:  rts
@miss:  lda gslot
        clc
        adc #2
        sta gslot
        cmp #8
        bcs @nohit
        jmp @hit
@nohit: rts

; Screen position of the man and the four ghosts. Off-screen ghosts
; are parked at sprite coordinate 0 so they do not wrap into view.
_place_sprites:
        sec
        lda _player_x
        sbc _cam_x
        sta gx
        lda _player_x+1
        sbc _cam_x+1
        sta gx+1
        clc
        lda gx
        adc #31
        sta gx
        lda gx+1
        adc #0
        sta gx+1
        sec
        lda _player_y
        sbc _cam_y
        sta gy
        lda _player_y+1
        sbc _cam_y+1
        sta gy+1
        clc
        lda gy
        adc #66
        sta gy
        bcc @py
        inc gy+1
@py:    lda gx
        sta $D000
        lda gy
        sta $D001
        lda #0
        sta msb
        lda gx+1
        beq @pg
        lda #1
        sta msb
@pg:    lda #0
        sta gslot
        lda #2
        sta bitm
@gs:    ldx gslot
        sec
        lda _ghost_x,x
        sbc _cam_x
        sta gx
        lda _ghost_x+1,x
        sbc _cam_x+1
        sta gx+1
        clc
        lda gx
        adc #31
        sta gx
        lda gx+1
        adc #0
        sta gx+1
        sec
        lda _ghost_y,x
        sbc _cam_y
        sta gy
        lda _ghost_y+1,x
        sbc _cam_y+1
        sta gy+1
        clc
        lda gy
        adc #66
        sta gy
        bcc @gy
        inc gy+1
@gy:    lda gslot
        clc
        adc #2
        tay
        jsr ghost_on_screen
        bcs @hide
        lda gx
        sta $D000,y
        lda gy
        sta $D001,y
        lda gx+1
        beq @nobit
        lda msb
        ora bitm
        sta msb
@nobit: jmp @adv
@hide:  lda #0
        sta $D000,y
        sta $D001,y
@adv:   asl bitm
        lda gslot
        clc
        adc #2
        sta gslot
        cmp #8
        bcs @msb
        jmp @gs
@msb:   jsr _place_foes
        lda msb
        ora #$20                ; minimap sprite sits past x = 255
        sta $D010
        jmp _plot_minimap

; Carry clear when the sprite coordinate in gx/gy is inside the window
; the C code used to accept (x 0..366, y 30..250).
ghost_on_screen:
        lda gx+1
        bmi @hide
        cmp #2
        bcs @hide
        cmp #1
        bcc @xok
        lda gx
        cmp #$6F
        bcs @hide
@xok:   lda gy+1
        bne @hide
        lda gy
        cmp #30
        bcc @hide
        cmp #251
        bcs @hide
        clc
        rts
@hide:  sec
        rts

; Clear the fixed status row on both screen matrices.
_blank_status:
        ldx #39
@b:     lda #32
        sta $0400,x
        sta $3800,x
        lda #0
        sta $D800,x
        dex
        bpl @b
        rts
