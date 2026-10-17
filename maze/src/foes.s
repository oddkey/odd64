; The devil and the ghost girl.
;
; From level 2 a devil patrols the longest straight corridor. It cannot
; cross a wall. When the player or a ghost is close and the line between
; them is open, it becomes a ball and rolls that way. A hit hurts. A wall
; stops the ball and the devil holds its head for three seconds. From
; level 3 a ghost girl walks through walls at the player's speed and
; steals a heart on every second touch. Walking into one of the four
; ghosts makes her stay with him, and the two of them kiss until the
; maze is left behind.
;
; Pictures are 8 pixels wide. They are expanded into the cassette buffer,
; sprite block 14 at $0380 for the devil and block 15 at $03C0 for her.

.importzp ptr1, tmp1, tmp2

.import _map, _level, _player_x, _player_y, _cam_x, _cam_y
.import _ghost_x, _ghost_y, _ghost_freeze
.import _life, _hurt_cool, _outcome
.import _screen_blank
.import _sound_siren, _sound_boulder, _sound_boulder_off, _sound_graze
.import box_wall, origin_ok, pixel_wall, tx, ty, px, py
.import gx, gy, msb, ghost_on_screen

.export _foe_arm
.export _foe_tick
.export _place_foes
.export _kiss_at
.export _ghost_stun
.export _girl_love
.export _girl_pair

.segment "BSS"

_ghost_stun: .res 4
_girl_love:  .res 1
_girl_pair:  .res 1
devil_on:    .res 1
devil_x:     .res 2
devil_y:     .res 2
devil_axis:  .res 1
devil_lo:    .res 2
devil_hi:    .res 2
devil_dir:   .res 1
devil_state: .res 1
devil_vx:    .res 1
devil_vy:    .res 1
devil_timer: .res 1
devil_pose:  .res 1
girl_on:     .res 1
girl_x:      .res 2
girl_y:      .res 2
girl_pose:   .res 1
girl_scratch:.res 1
girl_step:   .res 1
rowc:        .res 1
colc:        .res 1
run:         .res 1
startc:      .res 1
best:        .res 1
best_axis:   .res 1
best_fixed:  .res 1
best_0:      .res 1
best_1:      .res 1
axis_now:    .res 1
fixed_now:   .res 1
acc:         .res 2
acc2:        .res 2
cand_x:      .res 2
cand_y:      .res 2
win_x:       .res 2
win_y:       .res 2
best_d:      .res 1
have:        .res 1
diff:        .res 2
ayl:         .res 1
maskb:       .res 1
wx:          .res 2
wy:          .res 2

PATROL   = 0
CHARGE   = 1
STUN     = 2
RECOVER  = 3
RANGE    = 64
STUN_T   = 150
GHOST_T  = 200
RECOVER_T = 20

.segment "FOE"

; 0 and 1 walk, 2 the ball, 3 holding its head, 4 the girl, 5 the kiss.
frames:
        .byte $42, $7E, $DB, $FF, $BD, $7E, $3C, $66, $24, $24, $42, $81
        .byte $42, $7E, $DB, $FF, $BD, $7E, $3C, $66, $24, $44, $22, $21
        .byte $3C, $7E, $FF, $DB, $FF, $DB, $7E, $3C, $18, $24, $42, $81
        .byte $A5, $5A, $3C, $7E, $DB, $5A, $3C, $18, $18, $24, $24, $66
        .byte $24, $66, $5A, $3C, $18, $3C, $7E, $FF, $7E, $3C, $5A, $99
        .byte $66, $DB, $7E, $3C, $18, $3C, $7E, $7E, $3C, $18, $24, $42

; X = frame, A = 0 for the devil's buffer or 1 for the girl's.
blit_frame:
        pha
        lda #0
        sta ptr1+1
        txa
        asl
        rol ptr1+1
        asl
        rol ptr1+1
        sta acc
        txa
        asl
        clc
        adc acc
        sta ptr1
        lda ptr1+1
        adc #0
        sta ptr1+1
        asl ptr1
        rol ptr1+1
        clc
        lda ptr1
        adc #<frames
        sta ptr1
        lda ptr1+1
        adc #>frames
        sta ptr1+1
        pla
        bne @girl
        lda #$80
        ldx #$03
        bne @set
@girl:  lda #$C0
        ldx #$03
@set:   sta @pix+1
        stx @pix+2
        sta @z0+1
        stx @z0+2
        sta @z1+1
        stx @z1+2
        sta @z2+1
        stx @z2+2
        ldy #0
        ldx #0
@row:   lda (ptr1),y
@pix:   sta $0380,x
        inx
        lda #0
@z0:    sta $0380,x
        inx
@z1:    sta $0380,x
        inx
        iny
        cpy #12
        bne @row
        lda #0
@clr:   cpx #64
        bcs @done
@z2:    sta $0380,x
        inx
        bne @clr
@done:  rts

; tmp1 = row, tmp2 = column. ptr1 points at that map byte.
cell_ptr:
        lda tmp1
        sta acc
        lda #0
        sta acc+1
        ldx #5
@s32:   asl acc
        rol acc+1
        dex
        bne @s32
        lda tmp1
        sta acc2
        lda #0
        sta acc2+1
        ldx #7
@s128:  asl acc2
        rol acc2+1
        dex
        bne @s128
        clc
        lda acc
        adc acc2
        sta ptr1
        lda acc+1
        adc acc2+1
        sta ptr1+1
        clc
        lda ptr1
        adc tmp2
        sta ptr1
        lda ptr1+1
        adc #0
        sta ptr1+1
        clc
        lda ptr1
        adc #<_map
        sta ptr1
        lda ptr1+1
        adc #>_map
        sta ptr1+1
        rts

; Carry set when the cell in tmp1/tmp2 is not a wall.
cell_open:
        jsr cell_ptr
        ldy #0
        lda (ptr1),y
        cmp #160
        beq @no
        cmp #161
        beq @no
        sec
        rts
@no:    clc
        rts

open_h:
        lda rowc
        sta tmp1
        lda colc
        sta tmp2
        jsr cell_open
        bcc @no
        inc tmp1
        jsr cell_open
@no:    rts

open_v:
        lda rowc
        sta tmp1
        lda colc
        sta tmp2
        jsr cell_open
        bcc @no
        inc tmp2
        jsr cell_open
@no:    rts

take_run:
        lda run
        cmp best
        bcc @z
        beq @z
        sta best
        lda axis_now
        sta best_axis
        lda fixed_now
        sta best_fixed
        lda startc
        sta best_0
        clc
        adc run
        sec
        sbc #1
        sta best_1
@z:     lda #0
        sta run
        rts

spark:
        lda _screen_blank
        beq @out
        lda $DC04
        sta $D020
@out:   rts

; A = cell. Result * 8 in acc.
times8:
        sta acc
        lda #0
        sta acc+1
        asl acc
        rol acc+1
        asl acc
        rol acc+1
        asl acc
        rol acc+1
        rts

scan_corridor:
        lda #0
        sta best
        sta devil_on
        lda #2
        sta rowc
@hrow:  lda #0
        sta run
        sta axis_now
        lda rowc
        sta fixed_now
        lda #1
        sta colc
@hcol:  jsr open_h
        bcc @hgap
        lda run
        bne @hinc
        lda colc
        sta startc
@hinc:  inc run
        jmp @hnext
@hgap:  jsr take_run
@hnext: inc colc
        lda colc
        cmp #159
        bcc @hcol
        jsr take_run
        jsr spark
        clc
        lda rowc
        adc #4
        sta rowc
        cmp #98
        bcc @hrow
        lda #2
        sta colc
@vcol:  lda #1
        sta axis_now
        lda colc
        sta fixed_now
        lda #0
        sta run
        lda #1
        sta rowc
@vrow:  jsr open_v
        bcc @vgap
        lda run
        bne @vinc
        lda rowc
        sta startc
@vinc:  inc run
        jmp @vnext
@vgap:  jsr take_run
@vnext: inc rowc
        lda rowc
        cmp #99
        bcc @vrow
        jsr take_run
        jsr spark
        clc
        lda colc
        adc #4
        sta colc
        cmp #158
        bcs @scanned
        jmp @vcol
@scanned:
        lda best
        cmp #12
        bcs @keep
        jmp @none
@keep:  lda #1
        sta devil_on
        lda best_axis
        sta devil_axis
        lda best_0
        jsr times8
        lda acc
        sta devil_lo
        lda acc+1
        sta devil_lo+1
        lda best_1
        jsr times8
        lda devil_axis
        bne @vert
        lda acc
        sta devil_hi
        lda acc+1
        sta devil_hi+1
        sta devil_x+1
        lda acc
        sta devil_x
        lda best_fixed
        jsr times8
        lda acc
        sta devil_y
        lda acc+1
        sta devil_y+1
        lda #1
        sta devil_dir
        rts
@vert:  lda acc
        sec
        sbc #4
        sta devil_hi
        lda acc+1
        sbc #0
        sta devil_hi+1
        sta devil_y+1
        lda devil_hi
        sta devil_y
        lda best_fixed
        jsr times8
        lda acc
        sta devil_x
        lda acc+1
        sta devil_x+1
        lda #1
        sta devil_dir
        rts
@none:  lda #0
        sta devil_on
        rts

hide_buffers:
        lda #0
        tax
@c:     sta $0380,x
        sta $03C0,x
        inx
        cpx #64
        bne @c
        rts

_foe_arm:
        lda #0
        sta _girl_love
        sta girl_scratch
        sta devil_state
        sta devil_timer
        ldx #3
@s:     sta _ghost_stun,x
        dex
        bpl @s
        lda #$FF
        sta devil_pose
        sta girl_pose
        jsr hide_buffers
        lda #14
        sta $07FE
        sta $3BFE
        lda #15
        sta $07FF
        sta $3BFF
        lda #9
        sta $D02D
        lda #10
        sta $D02E
        lda _level
        cmp #2
        bcc @nog
        jsr scan_corridor
        jmp @girl
@nog:   lda #0
        sta devil_on
@girl:  lda _level
        cmp #3
        bcc @ng
        lda #1
        sta girl_on
        lda #$10
        sta girl_x
        lda #$04
        sta girl_x+1
        lda #$80
        sta girl_y
        lda #$02
        sta girl_y+1
        lda #4
        sta girl_pose
        tax
        lda #1
        jsr blit_frame
        jmp @dev
@ng:    lda #0
        sta girl_on
@dev:   lda devil_on
        beq @out
        lda #0
        sta devil_pose
        tax
        lda #0
        jsr blit_frame
@out:   rts

; wx/wy is the candidate top-left. Carry set when it fits and is open.
try_box:
        lda wx
        sta tx
        lda wx+1
        sta tx+1
        lda wy
        sta ty
        lda wy+1
        sta ty+1
        jsr origin_ok
        bcs @no
        jsr box_wall
        bcs @no
        sec
        rts
@no:    clc
        rts

commit:
        lda tx
        sta devil_x
        lda tx+1
        sta devil_x+1
        lda ty
        sta devil_y
        lda ty+1
        sta devil_y+1
        rts

; Move one pixel along the corridor. Reverse at a wall or at either end.
patrol_step:
        lda devil_x
        sta wx
        lda devil_x+1
        sta wx+1
        lda devil_y
        sta wy
        lda devil_y+1
        sta wy+1
        lda devil_axis
        bne @vy
        lda devil_dir
        bne @decx
        inc wx
        bne @xd
        inc wx+1
        jmp @xd
@decx:  lda wx
        bne @dx
        dec wx+1
@dx:    dec wx
@xd:    jmp @bounds
@vy:    lda devil_dir
        bne @decy
        inc wy
        bne @bounds
        inc wy+1
        jmp @bounds
@decy:  lda wy
        bne @dy
        dec wy+1
@dy:    dec wy
@bounds:
        lda devil_axis
        bne @by
        lda wx+1
        cmp devil_lo+1
        bcc @flip
        bne @hi
        lda wx
        cmp devil_lo
        bcc @flip
@hi:    lda devil_hi+1
        cmp wx+1
        bcc @flip
        bne @try
        lda devil_hi
        cmp wx
        bcc @flip
        bcs @try
@by:    lda wy+1
        cmp devil_lo+1
        bcc @flip
        bne @yhi
        lda wy
        cmp devil_lo
        bcc @flip
@yhi:   lda devil_hi+1
        cmp wy+1
        bcc @flip
        bne @try
        lda devil_hi
        cmp wy
        bcc @flip
@try:   jsr try_box
        bcc @flip
        jmp commit
@flip:  lda devil_dir
        eor #1
        sta devil_dir
        rts

; abs(cand - devil) on X into diff. Carry set when the distance is past RANGE.
span_x:
        sec
        lda cand_x
        sbc devil_x
        sta diff
        lda cand_x+1
        sbc devil_x+1
        sta diff+1
        bpl @abs
        lda diff
        eor #$FF
        clc
        adc #1
        sta diff
        lda diff+1
        eor #$FF
        adc #0
        sta diff+1
@abs:   lda diff+1
        bne @far
        lda diff
        cmp #RANGE
        rts
@far:   sec
        rts

span_y:
        sec
        lda cand_y
        sbc devil_y
        sta diff
        lda cand_y+1
        sbc devil_y+1
        sta diff+1
        bpl @abs
        lda diff
        eor #$FF
        clc
        adc #1
        sta diff
        lda diff+1
        eor #$FF
        adc #0
        sta diff+1
@abs:   lda diff+1
        bne @far
        lda diff
        cmp #RANGE
        rts
@far:   sec
        rts

; Average of devil and cand into px/py. Carry set when that pixel is a wall.
los_mid:
        clc
        lda devil_x
        adc cand_x
        sta px
        lda devil_x+1
        adc cand_x+1
        sta px+1
        lsr px+1
        ror px
        clc
        lda devil_y
        adc cand_y
        sta py
        lda devil_y+1
        adc cand_y+1
        sta py+1
        lsr py+1
        ror py
        clc
        lda px
        adc #3
        sta px
        bcc @x
        inc px+1
@x:     clc
        lda py
        adc #6
        sta py
        bcc @y
        inc py+1
@y:     jmp pixel_wall

; Carry clear when the candidate is in range and the midpoint is open.
try_cand:
        jsr span_x
        bcs @no
        lda diff
        sta ayl
        jsr span_y
        bcs @no
        clc
        lda diff
        adc ayl
        bcs @no
        cmp best_d
        bcs @no
        sta startc
        jsr los_mid
        bcs @no
        lda startc
        sta best_d
        lda cand_x
        sta win_x
        lda cand_x+1
        sta win_x+1
        lda cand_y
        sta win_y
        lda cand_y+1
        sta win_y+1
        lda #1
        sta have
@no:    rts

; A = signed step of 3 along diff, or 0 when diff is 0.
sign3:
        lda diff+1
        ora diff
        beq @z
        lda diff+1
        bmi @n
        lda #3
        rts
@n:     lda #$FD
        rts
@z:     lda #0
        rts

; Roll straight on the longer axis. A miss runs into the wall.
launch:
        sec
        lda win_x
        sbc devil_x
        sta diff
        lda win_x+1
        sbc devil_x+1
        sta diff+1
        lda diff
        sta acc
        lda diff+1
        sta acc+1
        jsr abs_diff
        lda diff
        sta ayl
        sec
        lda win_y
        sbc devil_y
        sta diff
        lda win_y+1
        sbc devil_y+1
        sta diff+1
        lda diff
        sta acc2
        lda diff+1
        sta acc2+1
        jsr abs_diff
        lda ayl
        cmp diff
        bcc @vy
        lda acc
        sta diff
        lda acc+1
        sta diff+1
        jsr sign3
        sta devil_vx
        lda #0
        sta devil_vy
        beq @go
@vy:    lda acc2
        sta diff
        lda acc2+1
        sta diff+1
        jsr sign3
        sta devil_vy
        lda #0
        sta devil_vx
@go:    lda devil_vx
        ora devil_vy
        beq @stay
        lda #CHARGE
        sta devil_state
        jmp _sound_boulder
@stay:  rts

abs_diff:
        lda diff+1
        bpl @ok
        lda diff
        eor #$FF
        clc
        adc #1
        sta diff
        lda diff+1
        eor #$FF
        adc #0
        sta diff+1
@ok:    rts

consider:
        lda #0
        sta have
        lda #$FF
        sta best_d
        lda _player_x
        sta cand_x
        lda _player_x+1
        sta cand_x+1
        lda _player_y
        sta cand_y
        lda _player_y+1
        sta cand_y+1
        jsr try_cand
        ldx #0
@g:     txa
        lsr
        tay
        lda _ghost_stun,y
        bne @skip
        lda _girl_love
        beq @free
        cpy _girl_pair
        beq @skip
@free:  lda _ghost_freeze,x
        ora _ghost_freeze+1,x
        bne @skip
        lda _ghost_x,x
        sta cand_x
        lda _ghost_x+1,x
        sta cand_x+1
        lda _ghost_y,x
        sta cand_y
        lda _ghost_y+1,x
        sta cand_y+1
        txa
        pha
        jsr try_cand
        pla
        tax
@skip:  inx
        inx
        cpx #8
        bcc @g
        lda have
        beq @out
        jmp launch
@out:   rts

; Carry set when |devil - player| is inside an 8 by 10 box.
touch_player:
        lda _player_x
        sta cand_x
        lda _player_x+1
        sta cand_x+1
        lda _player_y
        sta cand_y
        lda _player_y+1
        sta cand_y+1
        jmp touch_cand

touch_cand:
        sec
        lda cand_x
        sbc devil_x
        sta diff
        lda cand_x+1
        sbc devil_x+1
        sta diff+1
        jsr abs_diff
        lda diff+1
        bne @no
        lda diff
        cmp #8
        bcs @no
        sec
        lda cand_y
        sbc devil_y
        sta diff
        lda cand_y+1
        sbc devil_y+1
        sta diff+1
        jsr abs_diff
        lda diff+1
        bne @no
        lda diff
        cmp #10
        bcs @no
        sec
        rts
@no:    clc
        rts

hurt_player:
        lda _hurt_cool
        bne @out
        lda _life
        beq @dead
        sec
        sbc #1
        sta _life
        lda #40
        sta _hurt_cool
        jsr _sound_siren
        lda _life
        bne @out
@dead:  lda #2
        sta _outcome
@out:   rts

enter_recover:
        lda #RECOVER
        sta devil_state
        lda #RECOVER_T
        sta devil_timer
        jmp _sound_boulder_off

enter_stun:
        lda #STUN
        sta devil_state
        lda #STUN_T
        sta devil_timer
        jmp _sound_boulder_off

; Step the signed velocity. Carry clear when the step is open.
step_vel:
        lda devil_x
        sta wx
        lda devil_x+1
        sta wx+1
        lda devil_vx
        bmi @nx
        clc
        adc wx
        sta wx
        lda wx+1
        adc #0
        sta wx+1
        jmp @y
@nx:    clc
        adc wx
        sta wx
        lda wx+1
        adc #$FF
        sta wx+1
@y:     lda devil_y
        sta wy
        lda devil_y+1
        sta wy+1
        lda devil_vy
        bmi @ny
        clc
        adc wy
        sta wy
        lda wy+1
        adc #0
        sta wy+1
        jmp try_box
@ny:    clc
        adc wy
        sta wy
        lda wy+1
        adc #$FF
        sta wy+1
        jmp try_box

charge_step:
        jsr step_vel
        bcs @move
        jmp enter_stun
@move:  jsr commit
        jsr touch_player
        bcc @ghosts
        jsr hurt_player
        jmp enter_recover
@ghosts:
        ldx #0
@g:     txa
        lsr
        tay
        lda _ghost_stun,y
        bne @next
        lda _girl_love
        beq @live
        cpy _girl_pair
        beq @next
@live:  lda _ghost_x,x
        sta cand_x
        lda _ghost_x+1,x
        sta cand_x+1
        lda _ghost_y,x
        sta cand_y
        lda _ghost_y+1,x
        sta cand_y+1
        txa
        pha
        jsr touch_cand
        pla
        tax
        bcc @next
        txa
        lsr
        tay
        lda #GHOST_T
        sta _ghost_stun,y
        jmp enter_recover
@next:  inx
        inx
        cpx #8
        bcc @g
        rts

wait_state:
        lda devil_timer
        beq @go
        dec devil_timer
        bne @out
@go:    lda #PATROL
        sta devil_state
        jmp consider
@out:   rts

; Half speed while she is near enough to be shaken off. Full speed
; again as soon as that gap opens. The touch itself is still the
; smaller 8 by 10 box.
girl_pace:
        lda #2
        sta girl_step
        sec
        lda girl_x
        sbc _player_x
        sta diff
        lda girl_x+1
        sbc _player_x+1
        sta diff+1
        jsr abs_diff
        lda diff+1
        bne @far
        lda diff
        cmp #24
        bcs @far
        sec
        lda girl_y
        sbc _player_y
        sta diff
        lda girl_y+1
        sbc _player_y+1
        sta diff+1
        jsr abs_diff
        lda diff+1
        bne @far
        lda diff
        cmp #24
        bcs @far
        dec girl_step
@far:   rts

; She stops on the first ghost she overlaps and stays with him.
girl_meet:
        ldx #0
@g:     sec
        lda girl_x
        sbc _ghost_x,x
        sta diff
        lda girl_x+1
        sbc _ghost_x+1,x
        sta diff+1
        jsr abs_diff
        lda diff+1
        bne @next
        lda diff
        cmp #8
        bcs @next
        sec
        lda girl_y
        sbc _ghost_y,x
        sta diff
        lda girl_y+1
        sbc _ghost_y+1,x
        sta diff+1
        jsr abs_diff
        lda diff+1
        bne @next
        lda diff
        cmp #10
        bcs @next
        txa
        lsr
        jmp _kiss_at
@next:  inx
        inx
        cpx #8
        bcc @g
        rts

; The girl and the sprite placement sit with the playfield code. The
; corridor search and the devil's charge stay in the tail.
.segment "CODE"

; X is 0 for the horizontal pair and 2 for the vertical pair.
; The player and the girl each keep x then y in memory.
; girl_step is the most pixels she may close this frame.
approach:
        sec
        lda _player_x,x
        sbc girl_x,x
        sta diff
        lda _player_x+1,x
        sbc girl_x+1,x
        sta diff+1
        bmi @neg
        ora diff
        beq @out
        lda diff+1
        bne @cap
        lda diff
        cmp girl_step
        bcc @add
@cap:   lda girl_step
        sta diff
        lda #0
        sta diff+1
        beq @add
@neg:   lda diff+1
        cmp #$FF
        bne @mcap
        lda diff
        beq @mcap
        lda #0
        sec
        sbc diff
        cmp girl_step
        bcc @add
@mcap:  lda #0
        sec
        sbc girl_step
        sta diff
        lda #$FF
        sta diff+1
@add:   clc
        lda girl_x,x
        adc diff
        sta girl_x,x
        lda girl_x+1,x
        adc diff+1
        sta girl_x+1,x
@out:   rts

clamp_girl:
        lda girl_x+1
        bpl @xp
        lda #0
        sta girl_x
        sta girl_x+1
        beq @y
@xp:    cmp #5
        bcs @xc
        cmp #4
        bcc @y
        lda girl_x
        cmp #$F8
        bcc @y
@xc:    lda #$F8
        sta girl_x
        lda #$04
        sta girl_x+1
@y:     lda girl_y+1
        bpl @yp
        lda #0
        sta girl_y
        sta girl_y+1
        rts
@yp:    cmp #4
        bcs @yc
        cmp #3
        bcc @ok
        lda girl_y
        cmp #$14
        bcc @ok
@yc:    lda #$14
        sta girl_y
        lda #$03
        sta girl_y+1
@ok:    rts

girl_touch:
        sec
        lda girl_x
        sbc _player_x
        sta diff
        lda girl_x+1
        sbc _player_x+1
        sta diff+1
        jsr abs_diff
        lda diff+1
        bne @out
        lda diff
        cmp #8
        bcs @out
        sec
        lda girl_y
        sbc _player_y
        sta diff
        lda girl_y+1
        sbc _player_y+1
        sta diff+1
        jsr abs_diff
        lda diff+1
        bne @out
        lda diff
        cmp #10
        bcs @out
        lda _hurt_cool
        bne @out
        inc girl_scratch
        lda girl_scratch
        cmp #2
        bcc @graze
        lda #0
        sta girl_scratch
        lda _life
        beq @dead
        sec
        sbc #1
        sta _life
        lda #40
        sta _hurt_cool
        jsr _sound_siren
        lda _life
        bne @out
@dead:  lda #2
        sta _outcome
        rts
@graze: lda #25
        sta _hurt_cool
        jsr _sound_graze
@out:   rts

girl_tick:
        lda girl_on
        beq @out
        lda _girl_love
        bne @out
        jsr girl_pace
        ldx #0
        jsr approach
        ldx #2
        jsr approach
        jsr clamp_girl
        jsr girl_meet
        lda _girl_love
        bne @out
        jsr girl_touch
@out:   rts

pose_devil:
        lda devil_on
        beq @out
        lda devil_state
        cmp #CHARGE
        bne @nstun
        lda #2
        jmp @set
@nstun: cmp #STUN
        bne @walk
        lda #3
        jmp @set
@walk:  lda devil_axis
        bne @vy
        lda devil_x
        jmp @bit
@vy:    lda devil_y
@bit:   lsr
        lsr
        and #1
@set:   cmp devil_pose
        beq @out
        sta devil_pose
        tax
        lda #0
        jsr blit_frame
@out:   rts

pose_girl:
        lda girl_on
        beq @out
        lda _girl_love
        beq @walk
        lda #5
        bne @set
@walk:  lda #4
@set:   cmp girl_pose
        beq @out
        sta girl_pose
        tax
        lda #1
        jsr blit_frame
@out:   rts

_foe_tick:
        lda _outcome
        bne @out
        jsr girl_tick
        lda devil_on
        beq @pose
        lda devil_state
        cmp #CHARGE
        bne @ns
        jsr charge_step
        jmp @pose
@ns:    cmp #STUN
        beq @wait
        cmp #RECOVER
        bne @pat
@wait:  jsr wait_state
        jmp @pose
@pat:   jsr patrol_step
        jsr consider
@pose:  jsr pose_devil
        jmp pose_girl
@out:   rts

; World point in wx/wy. Carry set when it should be hidden.
project:
        sec
        lda wx
        sbc _cam_x
        sta gx
        lda wx+1
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
        lda wy
        sbc _cam_y
        sta gy
        lda wy+1
        sbc _cam_y+1
        sta gy+1
        clc
        lda gy
        adc #66
        sta gy
        bcc @py
        inc gy+1
@py:    jmp ghost_on_screen

; X = sprite register offset ($0C or $0E). maskb is the $D010 bit.
place_one:
        jsr project
        bcs @hide
        txa
        tay
        lda gx
        sta $D000,y
        lda gy
        sta $D001,y
        lda gx+1
        beq @out
        lda msb
        ora maskb
        sta msb
@out:   rts
@hide:  txa
        tay
        lda #0
        sta $D000,y
        sta $D001,y
        rts

_place_foes:
        lda #9
        sta $D02D
        lda #10
        sta $D02E
        lda devil_on
        beq @hd
        lda devil_x
        sta wx
        lda devil_x+1
        sta wx+1
        lda devil_y
        sta wy
        lda devil_y+1
        sta wy+1
        lda #$40
        sta maskb
        ldx #$0C
        jsr place_one
        jmp @girl
@hd:    lda #0
        sta $D00C
        sta $D00D
@girl:  lda girl_on
        beq @hg
        lda girl_x
        sta wx
        lda girl_x+1
        sta wx+1
        lda girl_y
        sta wy
        lda girl_y+1
        sta wy+1
        lda #$80
        sta maskb
        ldx #$0E
        jsr place_one
        jmp @kiss
@hg:    lda #0
        sta $D00E
        sta $D00F
@kiss:  lda _girl_love
        beq @out
        ldx _girl_pair
        inx
        lda #15
        sta $07F8,x
        sta $3BF8,x
        dex
        lda #10
        sta $D028,x
@out:   rts

; A = ghost index the player just walked through.
_kiss_at:
        cmp #4
        bcs @out
        ldx girl_on
        beq @out
        ldx _girl_love
        bne @out
        sta _girl_pair
        lda #1
        sta _girl_love
        lda _girl_pair
        asl
        tax
        lda _ghost_x+1,x
        bne @left
        lda _ghost_x,x
        cmp #12
        bcc @right
@left:  sec
        lda _ghost_x,x
        sbc #6
        sta girl_x
        lda _ghost_x+1,x
        sbc #0
        sta girl_x+1
        jmp @yy
@right: clc
        lda _ghost_x,x
        adc #6
        sta girl_x
        lda _ghost_x+1,x
        adc #0
        sta girl_x+1
@yy:    lda _ghost_y,x
        sta girl_y
        lda _ghost_y+1,x
        sta girl_y+1
        lda #5
        sta girl_pose
        tax
        lda #1
        jsr blit_frame
@out:   rts
