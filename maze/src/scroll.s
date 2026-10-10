; Character scroll between two off-screen buffers.
;
; The VIC is showing one 40x25 matrix. The other is built here, then
; $D018 flips to it in the bottom border at the same moment the fine
; scroll wraps. Doing the copy on the visible matrix makes the picture
; jump, because the copy takes longer than a frame.
;
; ptr1/ptr2/ptr3/ptr4 and tmp1/tmp2 are cc65 zero-page scratch.

.importzp ptr1, ptr2, ptr3, ptr4, tmp1, tmp2
.import popa

.export _shift_view
.export _blit_colors
.export _shift_ss, _shift_sd, _shift_cs, _shift_cd
.export _debug_jam

.segment "BSS"

_shift_ss:      .res 2
_shift_sd:      .res 2
_shift_cs:      .res 2
_shift_cd:      .res 2

.segment "CODE"

.macro add40 addr
        clc
        lda addr
        adc #40
        sta addr
        bcc :+
        inc addr+1
:
.endmacro

; void shift_view(unsigned char rows, unsigned char cols);
; Copies a rows*cols rectangle, stride 40, from _shift_ss/_shift_cs
; to _shift_sd/_shift_cd. The caller has already added the source and
; destination origin inside each buffer.
_shift_view:
        sta tmp1
        jsr popa
        sta tmp2
        lda _shift_ss
        sta ptr1
        lda _shift_ss+1
        sta ptr1+1
        lda _shift_sd
        sta ptr2
        lda _shift_sd+1
        sta ptr2+1
        lda _shift_cs
        sta ptr3
        lda _shift_cs+1
        sta ptr3+1
        lda _shift_cd
        sta ptr4
        lda _shift_cd+1
        sta ptr4+1
        ldx tmp2
@row:
        ldy tmp1
        dey
@col:
        lda (ptr1),y
        sta (ptr2),y
        lda (ptr3),y
        sta (ptr4),y
        dey
        bpl @col
        add40 ptr1
        add40 ptr2
        add40 ptr3
        add40 ptr4
        dex
        bne @row
        rts

; Column count of the scrolling window. main.c's PLAY_COLS must match.
.ifndef PLAY_COLS
PLAY_COLS = 40
.endif
.ifndef PLAY_ROWS
PLAY_ROWS = 24
.endif
; First screen row of the window. main.c's TITLE_ROWS must match.
.ifndef TOP_ROWS
TOP_ROWS = 1
.endif

; void blit_colors(unsigned char* src);
; Copy PLAY_COLS color bytes per row onto the playfield, starting at
; the column the pointer already points at. Stride is 40.
; Call this at raster 250 so the copy stays ahead of the beam.
_blit_colors:
        sta ptr1
        stx ptr1+1
        lda #<($D800+TOP_ROWS*40+((40-PLAY_COLS)/2))
        sta ptr2
        lda #>($D800+TOP_ROWS*40+((40-PLAY_COLS)/2))
        sta ptr2+1
.ifdef BLIT_MARK
        lda #2
        sta $d020
.endif
        ldx #PLAY_ROWS
@row:
        ldy #0
.repeat PLAY_COLS
        lda (ptr1),y
        sta (ptr2),y
        iny
.endrepeat
        add40 ptr1
        add40 ptr2
        dex
        beq @rowsdone
        jmp @row
@rowsdone:
.ifdef BLIT_MARK
        lda $d011
        bmi @marklate
        lda $d012
        lsr a
        lsr a
        lsr a
        lsr a
        sta $d020
        jmp @markdone
@marklate:
        lda #1
        sta $d020
@markdone:
.endif
        rts

; Halt the CPU. The VICE test build uses this so -jamaction 5
; can grab a screenshot. Never called by the normal game.
_debug_jam:
        .byte $02

; Cycle counter for the frame-budget test. Shipping builds never call it.
; A PAL frame is 19656 cycles; cyc_max above that means a frame was dropped.
.ifdef FRAME_MARK
.export _cyc_start
.export _cyc_max
.export _cyc_min
.export _cyc_last
.export _cyc_over
.export _cyc_lap

.segment "BSS"

_cyc_max:       .res 2
_cyc_min:       .res 2
_cyc_last:      .res 2
_cyc_over:      .res 1

.segment "CODE"

_cyc_armed:     .byte 0

_cyc_start:
        lda #$00
        sta $dc0e
        lda #$ff
        sta $dc04
        sta $dc05
        lda #$11
        sta $dc0e
        lda #$01
        sta _cyc_armed
        rts

_cyc_lap:
        lda _cyc_armed
        beq @leave
        lda #$00
        sta $dc0e
        lda $dc05
        sta tmp1
        lda $dc04
        sta tmp2
        lda #$ff
        sec
        sbc tmp2
        sta tmp2
        lda #$ff
        sbc tmp1
        sta tmp1
        lda tmp2
        sta _cyc_last
        lda tmp1
        sta _cyc_last+1
        lda tmp1
        cmp #$4C
        bcc @notover
        bne @over
        lda tmp2
        cmp #$C9
        bcc @notover
@over:
        inc _cyc_over
@notover:
        lda _cyc_max
        cmp tmp2
        lda _cyc_max+1
        sbc tmp1
        bcs @min
        lda tmp2
        sta _cyc_max
        lda tmp1
        sta _cyc_max+1
@min:
        lda _cyc_min
        ora _cyc_min+1
        beq @setmin
        lda _cyc_min
        cmp tmp2
        lda _cyc_min+1
        sbc tmp1
        bcc @leave
@setmin:
        lda tmp2
        sta _cyc_min
        lda tmp1
        sta _cyc_min+1
@leave: rts
.endif

; The maze scrolls from the top of the screen. This IRQ fires in the
; upper border and sets $D011/$D016 before the first badline.
; Phase 0 keeps yscroll 3. Other phases use (3-phase)&7.
.export _install_irq
.export _play_phase
.export _play_xreg
.export _screen_blank
.export _sprites_on

.segment "BSS"

_play_phase:    .res 1
_play_xreg:     .res 1
_screen_blank:  .res 1
_sprites_on:    .res 1

.segment "CODE"

_install_irq:
        sei
        lda #$7f
        sta $dc0d
        sta $dd0d
        lda $dc0d
        lda $dd0d
        lda #$35
        sta $01
        lda #$01
        sta $d01a
        lda #$1b
        sta $d011
        lda #0
        sta $d012
        lda #<irq_top
        sta $fffe
        lda #>irq_top
        sta $ffff
        lda #$ff
        sta $d019
        cli
        rts

irq_top:
        pha
        txa
        pha
        tya
        pha
        cld
        lda #$ff
        sta $d019
        lda _play_phase
        beq @phase0
        lda #3
        sec
        sbc _play_phase
        and #7
        ora #$18                ; 25 rows, screen on, yscroll
        jmp @yscroll
@phase0:
        lda #$1b                ; yscroll 3, 25 rows, screen on
@yscroll:
        ldx _play_xreg
        stx $d016
        ldy _screen_blank
        beq @vis
        and #$ef                ; bit 4 off, the picture stays blank
@vis:   sta $d011
        stx $d016
        lda #$00
        sta $d021
        lda _sprites_on
        beq @spr
        lda #$3F                ; player, ghosts, diamond map
@spr:   sta $d015
        ; Writing $D011 above clears the raster latch. Arm the next
        ; interrupt for line 0 only after this line has passed, or the
        ; compare fires again immediately.
        lda #1
        sta $d012
@past:
        lda $d012
        beq @past
        lda #0
        sta $d012
        lda #<irq_top
        sta $fffe
        lda #>irq_top
        sta $ffff
        pla
        tay
        pla
        tax
        pla
        rti
