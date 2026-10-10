; SID effects and the diamond minimap.
;
; Voice 1 ticks a short noise for each step. Voice 2 plays the pling
; and the fanfare. Voice 3 is the ghost siren, then the rising tone
; while the clock runs out at the door.
;
; The minimap is sprite 5, picture at $0340 (pointer 13), expanded to
; double width and height. It is multicolor: white diamonds, a yellow
; player, and red ghosts. One multicolor dot is two pixels wide, so
; each marker is also two rows tall and stays square when expanded.

.import _gem_x, _gem_y, _pickups_left, _time_left
.import _bomb_tick
.import _player_x, _player_y, _ghost_x, _ghost_y
.import popa
.importzp sp

.export _sound_init
.export _sound_tick
.export _sound_step
.export _sound_siren
.export _sound_door
.export _sound_sad
.export _plot_minimap
.export _note_gem
.export _door_tick

; cc65 puts this stack at the end of MAIN, which is the second screen.
; It grows down through the program. Bank out BASIC and park the stack
; at $C000 before any C function runs.
.constructor move_c_stack, 1
.segment "CODE"
move_c_stack:
        sei
        lda #$35
        sta $01
        lda #$00
        ldx #$C0
        sta sp
        stx sp+1
        rts

.segment "BSS"

siren_t:    .res 1
fan_i:      .res 1
fan_t:      .res 1
door_on:    .res 1
door_lo:    .res 1
door_hi:    .res 1
work:       .res 1
hold:       .res 1
ink:        .res 1

.segment "SOUND"

MAPRAM  = $0340

_sound_init:
        lda #$00
        ldx #$18
@clr:   sta $D400,x
        dex
        bpl @clr
        lda #$0F
        sta $D418
        lda #0
        sta door_on
        sta siren_t
        sta fan_i
        sta fan_t
        lda #$01
        sta $D405
        lda #$09
        sta $D40C
        lda #$20
        sta $D017
        sta $D01D
        sta $D01C               ; sprite 5 multicolor, the others stay hires
        lda #$01                ; %01 white, the diamonds
        sta $D025
        lda #$02                ; %11 red, the ghosts
        sta $D026
        lda #$07                ; %10 yellow, the player
        sta $D02C
        lda #36
        sta $D00A
        lda #206
        sta $D00B
        lda #13
        sta $07FD
        sta $3BFD
        rts

_sound_step:
        lda #$80
        sta $D404
        lda #$01
        sta $D405
        lda #$00
        sta $D406
        lda #$30
        sta $D400
        lda #$04
        sta $D401
        lda #$81
        sta $D404
        rts

_sound_pling:
        lda #$10
        sta $D40B
        lda #$00
        sta $D407
        lda #$38
        sta $D408
        lda #$11
        sta $D40B
        rts

_sound_siren:
        lda #42
        sta siren_t
        lda door_on
        bne @busy
        lda #$00
        sta $D413
        lda #$F0
        sta $D414
        lda #$10
        sta $D412
        lda #$11
        sta $D412
@busy:  rts

_sound_fanfare:
        lda #0
        sta fan_i
        lda #1
        sta fan_t
        rts

_sound_door:
        lda #1
        sta door_on
        lda #0
        sta siren_t
        sta door_lo
        lda #$02
        sta door_hi
        lda #$00
        sta $D413
        lda #$F8
        sta $D414
        lda #$20
        sta $D412
        lda #$21
        sta $D412
        rts

; A short minor phrase. Voice 1 carries it, voice 2 sits a third below.
_sound_sad:
        lda #$0F
        sta $D418
        lda #$00
        sta $D404
        sta $D40B
        sta $D412
        lda #$56
        sta $D405
        sta $D40C
        lda #$89
        sta $D406
        sta $D40D
        ldx #0
@n:     lda sad_dur,x
        beq @done
        lda sad_lo,x
        sta $D400
        lda sad_hi,x
        sta $D401
        lda sad_lo2,x
        sta $D407
        lda sad_hi2,x
        sta $D408
        lda #$11
        sta $D404
        sta $D40B
        lda sad_dur,x
        jsr sad_wait
        lda #$10
        sta $D404
        sta $D40B
        lda #8
        jsr sad_wait
        inx
        bne @n
@done:  rts

sad_wait:
        tay
@f:     lda #250
@w:     cmp $D012
        bne @w
@x:     cmp $D012
        beq @x
        dey
        bne @f
        rts

sad_lo:  .byte $A2, $67, $89, $ED, $89, $67, $6D, $A2
sad_hi:  .byte $0E, $11, $13, $15, $13, $11, $10, $0E
sad_lo2: .byte $9D, $A2, $6D, $67, $6D, $A2, $0A, $9D
sad_hi2: .byte $0B, $0E, $10, $11, $10, $0E, $0D, $0B
sad_dur: .byte 24, 24, 24, 36, 24, 24, 28, 56, 0

_sound_end:
        lda #0
        sta door_on
        sta siren_t
        sta fan_t
        lda #$80
        sta $D404
        lda #$10
        sta $D40B
        lda #$20
        sta $D412
        rts

_sound_tick:
        lda siren_t
        beq @fan
        dec siren_t
        beq @siren_off
        lda door_on
        bne @fan
        lda siren_t
        and #$07
        tay
        lda wobble,y
        sta $D40F
        lda #$80
        sta $D40E
        jmp @fan
@siren_off:
        lda door_on
        bne @fan
        lda #$10
        sta $D412
@fan:   lda fan_t
        beq @door
        dec fan_t
        bne @door
        ldy fan_i
        lda notes,y
        beq @fan_off
        sta $D408
        lda #$00
        sta $D407
        lda #$10
        sta $D40B
        lda #$11
        sta $D40B
        inc fan_i
        lda #6
        sta fan_t
        jmp @door
@fan_off:
        lda #$10
        sta $D40B
@door:  lda door_on
        beq @out
        clc
        lda door_lo
        adc #$30
        sta door_lo
        sta $D40E
        lda door_hi
        adc #$00
        cmp #$48
        bcc @store
        lda #$48
@store: sta door_hi
        sta $D40F
@out:   jsr _bomb_tick
        rts

; Fastcall: row in A, column popped. Clears that diamond, redraws, plings.
_note_gem:
        sta work
        jsr popa
        sta hold
        ldx #0
@find:  lda _gem_x,x
        cmp hold
        bne @nx
        lda _gem_y,x
        cmp work
        bne @nx
        lda #$FF
        sta _gem_x,x
@nx:    inx
        cpx #10
        bne @find
        jsr _plot_minimap
        lda _pickups_left
        bne @pling
        jmp _sound_fanfare
@pling: jmp _sound_pling

; Counts the clock down one second per frame. Returns 1 when it hits zero.
_door_tick:
        jsr _sound_tick
        lda _time_left
        ora _time_left+1
        beq @done
        lda _time_left
        bne @lo
        dec _time_left+1
@lo:    dec _time_left
        lda #0
        rts
@done:  jsr _sound_end
        lda #1
        rts

; 12 by 10 multicolor cells. A marker is one dot wide and two rows
; tall, so hardware expansion keeps it square. Diamonds first, then
; ghosts, then the player, so a ghost covers a diamond and the player
; covers both.
_plot_minimap:
        ldy #62
        lda #0
@wipe:  sta MAPRAM,y
        dey
        bpl @wipe
        ldx #0
@gem:   lda _gem_x,x
        cmp #$FF
        beq @ng
        txa
        pha
        lda _gem_y,x
        tay
        lda _gem_x,x
        tax
        lda #$01
        jsr stamp_xy
        pla
        tax
@ng:    inx
        cpx #10
        bne @gem
        jsr plot_ghosts
        jmp plot_player

plot_ghosts:
        ldx #0
@g:     txa
        pha
        lda _ghost_x,x
        ldy _ghost_x+1,x
        jsr pix_cell
        pha
        lda _ghost_y,x
        ldy _ghost_y+1,x
        jsr pix_cell
        tay
        pla
        tax
        lda #$03
        jsr stamp_xy
        pla
        tax
        inx
        inx
        cpx #8
        bne @g
        rts

plot_player:
        lda _player_x
        ldy _player_x+1
        jsr pix_cell
        pha
        lda _player_y
        ldy _player_y+1
        jsr pix_cell
        tay
        pla
        tax
        lda #$02
        jmp stamp_xy

; A = low byte, Y = high byte of a pixel coordinate. Returns the cell.
pix_cell:
        sta work
        tya
        lsr
        ror work
        lsr
        ror work
        lsr
        ror work
        lda work
        rts

; X = cell column, Y = cell row, A = color code 1, 2 or 3.
stamp_xy:
        sta ink
        tya
        pha
        txa
        jsr col_slot
        sta work
        pla
        jsr row_slot
        asl
        sta hold
        lda hold
        asl
        clc
        adc hold
        sta hold
        lda work
        lsr
        lsr
        clc
        adc hold
        sta hold
        lda work
        and #$03
        tax
        lda mask,x
        sta work
        lda ink
        cpx #3
        beq @bit
        asl
        asl
        cpx #2
        beq @bit
        asl
        asl
        cpx #1
        beq @bit
        asl
        asl
@bit:   sta ink
        ldy hold
        jsr poke
        tya
        clc
        adc #3
        tay
poke:   lda work
        eor #$FF
        and MAPRAM,y
        ora ink
        sta MAPRAM,y
        rts

; A = map column 0..159. Returns A = column*12/160, at most 11.
col_slot:
        sta work
        lda #0
        sta hold
        asl work
        rol hold
        asl work
        rol hold
        lda work
        pha
        lda hold
        pha
        asl work
        rol hold
        pla
        clc
        adc hold
        sta hold
        pla
        clc
        adc work
        sta work
        bcc @div
        inc hold
@div:   ldy #0
@sub:   lda work
        cmp #160
        lda hold
        sbc #0
        bcc @quot
        lda work
        sec
        sbc #160
        sta work
        lda hold
        sbc #0
        sta hold
        iny
        cpy #12
        bcc @sub
@quot:  tya
        cmp #12
        bcc @ok
        lda #11
@ok:    rts

; A = map row 0..99. Returns A = row/10, at most 9.
row_slot:
        ldy #0
@s:     cmp #10
        bcc @q
        sec
        sbc #10
        iny
        bne @s
@q:     tya
        cmp #10
        bcc @ok
        lda #9
@ok:    rts

mask:   .byte $C0, $30, $0C, $03
wobble: .byte $06, $0A, $10, $18, $10, $0A, $06, $04
notes:  .byte $16, $1C, $22, $2C, $38, $2C, $38, $00
