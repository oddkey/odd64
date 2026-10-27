; Multicolor bitmap and its color matrix in VIC bank 1. main fills both.
; Color RAM stays at $D800. Bit 3 set means the cell is multicolor.
.segment "BITMAP"
.export _bitmap
_bitmap:
        .res 8192, 0

.segment "SCREEN"
.export _screen
_screen:
        .res 1024, 0

; Plot one block as 5 by 11 multicolor pixels.
; Bit 4 of each row word is the leftmost pixel. Each pixel is two hires
; dots wide. A cell keeps up to three inks plus the black background.
; void blit_block(const unsigned int *rows, unsigned int x, unsigned int y,
;                 unsigned char color)
.import popax
.importzp ptr1, ptr2, tmp1, tmp2, tmp3, tmp4

.segment "BSS"
bits:   .res 1
mask:   .res 1
ycell:  .res 1
xcell:  .res 1
offlo:  .res 1
offhi:  .res 1
scrbyte:.res 1
cram:   .res 1
code:   .res 1
shift:  .res 1

.segment "CODE"
.export _blit_block
.proc _blit_block
        sta tmp4
        jsr popax
        sta tmp3
        jsr popax
        sta tmp1
        stx tmp2
        jsr popax
        sta ptr2
        stx ptr2+1
        ldy #0
rowloop:
        lda (ptr2),y
        sta bits
        iny
        iny
        tya
        pha
        lda bits
        beq nextrow
        lda tmp1
        pha
        lda tmp2
        pha
        lda #$10
        sta mask
        ldx #5
bitloop:
        lda bits
        and mask
        beq skippix
        jsr plotmc
skippix:
        lda tmp1
        clc
        adc #2
        sta tmp1
        bcc noxhi
        inc tmp2
noxhi:  lsr mask
        dex
        bne bitloop
        pla
        sta tmp2
        pla
        sta tmp1
nextrow:
        inc tmp3
        pla
        tay
        cpy #22
        bne rowloop
        rts

plotmc:
        txa
        pha
        lda tmp3
        lsr
        lsr
        lsr
        sta ycell
        lda tmp1
        sta xcell
        lda tmp2
        lsr
        ror xcell
        lsr
        ror xcell
        lsr
        ror xcell
        lda #0
        sta offhi
        lda ycell
        asl
        rol offhi
        asl
        rol offhi
        asl
        rol offhi
        asl
        rol offhi
        asl
        rol offhi
        sta offlo
        lda ycell
        asl
        asl
        asl
        clc
        adc offlo
        sta offlo
        lda offhi
        adc #0
        sta offhi
        lda offlo
        clc
        adc xcell
        sta offlo
        lda offhi
        adc #0
        sta offhi
        lda offlo
        clc
        adc #<_screen
        sta ptr1
        lda offhi
        adc #>_screen
        sta ptr1+1
        ldy #0
        lda (ptr1),y
        sta scrbyte
        lda offlo
        clc
        adc #<$D800
        sta ptr1
        lda offhi
        adc #>$D800
        sta ptr1+1
        ldy #0
        lda (ptr1),y
        ora #$08
        sta cram
        lda scrbyte
        lsr
        lsr
        lsr
        lsr
        cmp tmp4
        bne not01
        lda #1
        sta code
        jmp paint
not01:  lda scrbyte
        and #$0F
        cmp tmp4
        bne not10
        lda #2
        sta code
        jmp paint
not10:  lda cram
        and #$07
        cmp tmp4
        bne not11
        lda #3
        sta code
        jmp paint
not11:  lda scrbyte
        and #$F0
        bne try10
        lda tmp4
        asl
        asl
        asl
        asl
        ora scrbyte
        sta scrbyte
        lda #1
        sta code
        jmp paint
try10:  lda scrbyte
        and #$0F
        bne try11
        lda scrbyte
        and #$F0
        ora tmp4
        sta scrbyte
        lda #2
        sta code
        jmp paint
try11:  lda tmp4
        ora #$08
        sta cram
        lda #3
        sta code
paint:  lda offlo
        clc
        adc #<_screen
        sta ptr1
        lda offhi
        adc #>_screen
        sta ptr1+1
        ldy #0
        lda scrbyte
        sta (ptr1),y
        lda offlo
        clc
        adc #<$D800
        sta ptr1
        lda offhi
        adc #>$D800
        sta ptr1+1
        ldy #0
        lda cram
        sta (ptr1),y
        lda tmp1
        and #6
        sta shift
        lda #6
        sec
        sbc shift
        sta shift
        lda code
        ldx shift
        beq codesh
codesl: asl
        dex
        bne codesl
codesh: sta code
        lda #3
        ldx shift
        beq masksh
masksl: asl
        dex
        bne masksl
masksh: eor #$FF
        sta shift
        lda #0
        sta offhi
        lda ycell
        asl
        rol offhi
        asl
        rol offhi
        asl
        rol offhi
        asl
        rol offhi
        asl
        rol offhi
        asl
        rol offhi
        sta offlo
        lda offhi
        clc
        adc ycell
        sta offhi
        ; xcell*8 can be 256 or more. Keep that bit, or columns past
        ; x=255 are drawn 256 pixels to the left.
        lda xcell
        asl
        asl
        asl
        bcc xoff
        inc offhi
xoff:   clc
        adc offlo
        sta offlo
        bcc xdone
        inc offhi
xdone:
        lda tmp3
        and #7
        clc
        adc offlo
        sta offlo
        lda offhi
        adc #0
        sta offhi
        lda offlo
        clc
        adc #<_bitmap
        sta ptr1
        lda offhi
        adc #>_bitmap
        sta ptr1+1
        ldy #0
        lda (ptr1),y
        and shift
        ora code
        sta (ptr1),y
        pla
        tax
        rts
.endproc
