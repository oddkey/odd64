; Bombs and stunned ghosts. The fuse, the blast, and the button
; live here so the playfield code can stay below the second screen.

.importzp ptr1, ptr2

.import gindex
.import _ghost_freeze
.import _bomb_x, _bomb_y, _bomb_phase, _bomb_timer, _bomb_mask, _bombs_left
.import _map, _player_x, _player_y, _ghost_x, _ghost_y
.import _life, _outcome, _pickups_left, _gem_x, _gem_y
.import _origin_x, _seam_y, _color_a, _color_b
.import _bomb_status

.export _ghost_hold
.export _walk3
.export _button_down
.export _bomb_tick
.export _bomb_reset

.segment "BSS"

cell_ok:    .res 1
cell_x:     .res 1
cell_y:     .res 1
cell_bit:   .res 2
down:       .res 1
bx:         .res 1
by:         .res 1
bdx:        .res 1
bdy:        .res 1
sx:         .res 1
sy:         .res 1
sch:        .res 1
sink:       .res 1
col:        .res 1
row:        .res 1
l8:         .res 1
h8:         .res 1
cx:         .res 1
cy:         .res 1
bomb_i:     .res 1
bomb_slot:  .res 1
bomb_job:   .res 1
bomb_built: .res 2
fire_was:   .res 1
fuse_hue:   .res 1
boom_t:     .res 1
hiss_on:    .res 1
burning:    .res 1
exploded:   .res 1
tile:       .res 1

.segment "BOMB"

_bomb_tick:
        jsr _button_down
        cmp #1
        bcc @rel
        lda fire_was
        bne @mark
        jsr try_place
@mark:  lda #1
        sta fire_was
        jmp @run
@rel:   lda #0
        sta fire_was
@run:   inc fuse_hue
        lda #0
        sta burning
        sta exploded
        sta bomb_i
@loop:  ldx bomb_i
        lda _bomb_phase,x
        cmp #1
        beq @fuse
        cmp #2
        bne @next
        jsr paint_blast
        jmp @next
@fuse:  dec _bomb_timer,x
        bne @burn
        lda bomb_i
        jsr explode
        lda #1
        sta exploded
        jmp @next
@burn:  ldx bomb_i
        jsr paint_fuse
        lda #1
        sta burning
@next:  inc bomb_i
        lda bomb_i
        cmp #3
        bcc @loop
        lda exploded
        beq @snd
        jsr boom
        lda #20
        sta boom_t
        lda #0
        sta hiss_on
@snd:   lda boom_t
        beq @maybe
        dec boom_t
        rts
@maybe: lda burning
        beq @off
        jsr hiss
        lda #1
        sta hiss_on
        rts
@off:   lda hiss_on
        beq @rts
        lda #$80
        sta $D404
        lda #0
        sta hiss_on
@rts:   rts

_ghost_hold:
        lda gindex
        asl
        tax
        lda _ghost_freeze,x
        ora _ghost_freeze+1,x
        bne @busy
        clc
        rts
@busy:  lda _ghost_freeze,x
        bne @lo
        dec _ghost_freeze+1,x
@lo:    dec _ghost_freeze,x
        lda _ghost_freeze,x
        ora _ghost_freeze+1,x
        bne @stay
        ldy gindex
        lda ink,y
        sta $D028,y
        clc
        rts
@stay:  sec
        rts

; Slot in A. Calls touch_cell nine times.
_walk3:
        tax
        lda _bomb_x,x
        sta bx
        lda _bomb_y,x
        sta by
        ldx #0
@n:     lda #0
        sta bdy
        txa
@div:   cmp #3
        bcc @dx
        sbc #3
        inc bdy
        jmp @div
@dx:    sta bdx
        lda #0
        sta cell_ok
        clc
        lda bx
        adc bdx
        sec
        sbc #1
        bcc @bit
        cmp #160
        bcs @bit
        sta cell_x
        clc
        lda by
        adc bdy
        sec
        sbc #1
        bcc @bit
        cmp #100
        bcs @bit
        sta cell_y
        lda #1
        sta cell_ok
@bit:   lda bitlo,x
        sta cell_bit
        lda bithi,x
        sta cell_bit+1
        txa
        pha
        jsr touch_cell
        pla
        tax
        inx
        cpx #9
        bcc @n
        rts

touch_cell:
        lda cell_ok
        bne @in
        lda bomb_job
        bne @out
        jmp mark_bit
@out:   rts
@in:    jsr map_ptr
        ldy #0
        lda (ptr1),y
        sta tile
        lda bomb_job
        bne @later
        lda tile
        cmp #161
        beq @prot
        cmp #31
        beq @prot
        cmp #90
        bne @break
        jsr scrap_gem
@break: jsr map_ptr
        ldy #0
        lda #42
        sta (ptr1),y
        lda #42
        sta sch
        lda #1
        sta sink
        jmp show_xy
@prot:  jsr mark_bit
        lda #42
        sta sch
        lda #1
        sta sink
        jmp show_xy
@later: jsr covered
        lda bomb_job
        cmp #2
        bne @blink
        lda covered_f
        bne @real
        jsr map_ptr
        ldy #0
        lda #102
        sta (ptr1),y
@real:  jmp show_real
@blink: ldx bomb_slot
        lda _bomb_timer,x
        lsr
        lsr
        lsr
        and #1
        bne @off
        lda covered_f
        bne @star
        jsr map_ptr
        ldy #0
        lda #42
        sta (ptr1),y
@star:  lda #42
        sta sch
        lda #1
        sta sink
        jmp show_xy
@off:   lda covered_f
        bne @real
        jsr map_ptr
        ldy #0
        lda #102
        sta (ptr1),y
        jmp show_real

mark_bit:
        lda bomb_built
        ora cell_bit
        sta bomb_built
        lda bomb_built+1
        ora cell_bit+1
        sta bomb_built+1
        rts

; covered_f = 1 when this cell keeps its map value.
covered:
        lda bomb_slot
        asl
        tax
        lda _bomb_mask,x
        and cell_bit
        bne @yes
        lda _bomb_mask+1,x
        and cell_bit+1
        bne @yes
        lda #0
        sta covered_f
        rts
@yes:   lda #1
        sta covered_f
        rts

show_real:
        jsr map_ptr
        ldy #0
        lda (ptr1),y
        cmp #161
        bne @col
        lda #160
        sta sch
        lda #6
        sta sink
        jmp show_xy
@col:   sta sch
        jsr color_of
        sta sink
show_xy:
        lda cell_x
        sta sx
        lda cell_y
        sta sy
        jmp show_cell

; A = tile. Color in A.
color_of:
        cmp #160
        bne @o
        lda #14
        rts
@o:     cmp #46
        bne @s
        lda #5
        rts
@s:     cmp #42
        beq @w
        cmp #90
        beq @w
        cmp #81
        bne @d
@w:     lda #1
        rts
@d:     cmp #31
        bne @sp
        lda #7
        rts
@sp:    cmp #32
        bne @g
        lda #0
        rts
@g:     lda #11
        rts

scrap_gem:
        ldx #0
@g:     lda _gem_x,x
        cmp cell_x
        bne @n
        lda _gem_y,x
        cmp cell_y
        bne @n
        lda #$FF
        sta _gem_x,x
        lda _pickups_left
        beq @out
        dec _pickups_left
@out:   rts
@n:     inx
        cpx #10
        bne @g
        rts

; A = slot.
explode:
        sta bomb_slot
        lda #0
        sta bomb_job
        sta bomb_built
        sta bomb_built+1
        lda bomb_slot
        jsr _walk3
        lda bomb_slot
        asl
        tax
        lda bomb_built
        sta _bomb_mask,x
        lda bomb_built+1
        sta _bomb_mask+1,x
        ldx bomb_slot
        lda #2
        sta _bomb_phase,x
        lda #50
        sta _bomb_timer,x
        ldy #0
@chain: cpy bomb_slot
        beq @cn
        lda _bomb_phase,y
        cmp #1
        bne @cn
        lda _bomb_x,y
        sta cx
        lda _bomb_y,y
        sta cy
        ldx bomb_slot
        jsr near_x
        bcc @cn
        lda #1
        sta _bomb_timer,y
@cn:    iny
        cpy #3
        bne @chain
        ldy #0
@man:   lda _player_x
        clc
        adc hx,y
        sta l8
        lda _player_x+1
        adc #0
        jsr shift3
        lda l8
        sta cx
        lda _player_y
        clc
        adc hy,y
        sta l8
        lda _player_y+1
        adc #0
        jsr shift3
        lda l8
        sta cy
        ldx bomb_slot
        jsr near_x
        bcs @hurt
        iny
        cpy #6
        bne @man
        jmp @ghosts
@hurt:  lda _life
        beq @ghosts
        dec _life
        bne @ghosts
        lda #2
        sta _outcome
@ghosts:
        ldy #0
@gs:    tya
        pha
        asl
        tax
        lda _ghost_x,x
        clc
        adc #4
        sta l8
        lda _ghost_x+1,x
        adc #0
        jsr shift3
        lda l8
        sta cx
        pla
        pha
        asl
        tax
        lda _ghost_y,x
        clc
        adc #6
        sta l8
        lda _ghost_y+1,x
        adc #0
        jsr shift3
        lda l8
        sta cy
        ldx bomb_slot
        jsr near_x
        bcc @gn
        pla
        tay
        tya
        asl
        tax
        lda #$E8
        sta _ghost_freeze,x
        lda #$03
        sta _ghost_freeze+1,x
        lda #0
        sta $D028,y
        jmp @gstep
@gn:    pla
        tay
@gstep: iny
        cpy #4
        bne @gs
        rts

; >> 3 of the 16-bit value whose low byte is l8 and high byte is A.
shift3:
        lsr
        ror l8
        lsr
        ror l8
        lsr
        ror l8
        rts

; Carry set when cx,cy is inside the 3x3 of slot X.
near_x:
        lda cx
        cmp _bomb_x,x
        bcs @xg
        lda _bomb_x,x
        sec
        sbc cx
        jmp @xd
@xg:    sec
        sbc _bomb_x,x
@xd:    cmp #2
        bcs @no
        lda cy
        cmp _bomb_y,x
        bcs @yg
        lda _bomb_y,x
        sec
        sbc cy
        jmp @yd
@yg:    sec
        sbc _bomb_y,x
@yd:    cmp #2
        bcs @no
        sec
        rts
@no:    clc
        rts

paint_blast:
        stx bomb_slot
        lda _bomb_timer,x
        bne @go
        lda #2
        sta bomb_job
        lda bomb_slot
        jsr _walk3
        ldx bomb_slot
        lda #0
        sta _bomb_phase,x
        rts
@go:    lda #1
        sta bomb_job
        lda bomb_slot
        jsr _walk3
        ldx bomb_slot
        dec _bomb_timer,x
        rts

paint_fuse:
        lda _bomb_x,x
        sta sx
        lda _bomb_y,x
        sta sy
        lda #81
        sta sch
        lda #1
        sta sink
        jsr show_cell
        lda sy
        beq @done
        dec sy
        lda sx
        sta cell_x
        lda sy
        sta cell_y
        jsr map_ptr
        ldy #0
        lda (ptr1),y
        cmp #160
        beq @rev
        cmp #161
        beq @rev
        lda #85
        bne @glyph
@rev:   lda #213
@glyph: sta sch
        jsr fuse_col
        sta sink
        jsr show_cell
@done:  rts

fuse_col:
        lda fuse_hue
        lsr
        lsr
        lsr
        sec
@m:     sbc #3
        bcs @m
        adc #3
        tax
        lda fcols,x
        rts

try_place:
        lda _bombs_left
        bne @have
        rts
@have:  lda _player_x
        clc
        adc #4
        sta l8
        lda _player_x+1
        adc #0
        jsr shift3
        lda l8
        sta cx
        cmp #160
        bcc @cx
        rts
@cx:    lda _player_y
        clc
        adc #6
        sta l8
        lda _player_y+1
        adc #0
        jsr shift3
        lda l8
        sta cy
        cmp #100
        bcc @cy
        rts
@cy:    lda cx
        sta cell_x
        lda cy
        sta cell_y
        jsr map_ptr
        ldy #0
        lda (ptr1),y
        cmp #102
        beq @open
        cmp #32
        beq @open
        rts
@open:  ldy #0
@chk:   lda _bomb_phase,y
        cmp #1
        bne @blast
        lda _bomb_x,y
        cmp cx
        bne @blast
        lda _bomb_y,y
        cmp cy
        bne @blast
        rts
@blast: lda _bomb_phase,y
        cmp #2
        bne @cn
        tya
        tax
        jsr near_x
        bcc @cn
        rts
@cn:    iny
        cpy #3
        bne @chk
        ldy #0
@find:  lda _bomb_phase,y
        beq @use
        iny
        cpy #3
        bne @find
        rts
@use:   lda cx
        sta _bomb_x,y
        lda cy
        sta _bomb_y,y
        lda #1
        sta _bomb_phase,y
        lda #150
        sta _bomb_timer,y
        tya
        pha
        lda cx
        sta cell_x
        lda cy
        sta cell_y
        jsr map_ptr
        ldy #0
        lda #81
        sta (ptr1),y
        dec _bombs_left
        jsr _bomb_status
        pla
        tax
        jmp paint_fuse

; Port 1 left shares the Control line, so a stick held that way
; looks like fire on every column. Sample the stick with no column
; selected and ignore those bits in the key scan. Space is bit 4 and
; Control is bit 2 of the $7F column; either one plants a bomb.
_bomb_reset:
        lda #0
        sta boom_t
        sta hiss_on
        sta fire_was
        ldx #2
@c:     sta _bomb_phase,x
        sta _bomb_timer,x
        dex
        bpl @c
        ldx #7
@g:     sta _ghost_freeze,x
        dex
        bpl @g
        rts

_button_down:
        sei
        lda #0
        sta down
        lda #$FF
        sta $DC02
        sta $DC00
        lda $DC01
        tax
        and #$10
        bne @p2
        inc down
@p2:    lda #0
        sta $DC02
        lda $DC00
        and #$10
        bne @key
        inc down
@key:   lda #$FF
        sta $DC02
        lda #$7F
        sta $DC00
        lda $DC01
        tay
        txa
        and #$10
        beq @ctl
        tya
        and #$10
        bne @ctl
        inc down
@ctl:   txa
        and #$04
        beq @up
        tya
        and #$04
        bne @up
        inc down
@up:    lda #$FF
        sta $DC00
        cli
        lda down
        rts

hiss:
        lda fuse_hue
        asl
        asl
        asl
        asl
        sta $D400
        lda #$18
        sta $D401
        lda #0
        sta $D405
        lda #$F8
        sta $D406
        lda #$80
        sta $D404
        lda #$81
        sta $D404
        rts

boom:
        lda #0
        sta $D400
        lda #4
        sta $D401
        lda #$0C
        sta $D405
        lda #0
        sta $D406
        lda #$80
        sta $D404
        lda #$81
        sta $D404
        rts

; Offset of map[cell_y][cell_x] in ptr1.
map_ptr:
        lda #0
        sta h8
        lda cell_y
        asl
        rol h8
        asl
        rol h8
        asl
        rol h8
        asl
        rol h8
        asl
        rol h8
        sta l8
        lda l8
        sta ptr1
        lda h8
        sta ptr1+1
        asl ptr1
        rol ptr1+1
        asl ptr1
        rol ptr1+1
        clc
        lda ptr1
        adc l8
        sta ptr1
        lda ptr1+1
        adc h8
        sta ptr1+1
        clc
        lda ptr1
        adc cell_x
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

show_cell:
        lda sx
        cmp _origin_x
        bcs @xok
        rts
@xok:   sec
        sbc _origin_x
        cmp #40
        bcc @wide
        rts
@wide:  sta col
        lda _seam_y
        cmp #$FF
        bne @seam
        lda sy
        clc
        adc #2
        jmp @row
@seam:  lda sy
        clc
        adc #1
        cmp _seam_y
        bcs @on
        rts
@on:    sec
        sbc _seam_y
@row:   cmp #1
        bcs @rlow
        rts
@rlow:  cmp #25
        bcc @rhigh
        rts
@rhigh: sta row
        lda #0
        sta h8
        lda row
        asl
        rol h8
        asl
        rol h8
        asl
        rol h8
        sta l8
        lda l8
        sta ptr1
        lda h8
        sta ptr1+1
        asl ptr1
        rol ptr1+1
        asl ptr1
        rol ptr1+1
        clc
        lda ptr1
        adc l8
        sta ptr1
        lda ptr1+1
        adc h8
        sta ptr1+1
        clc
        lda ptr1
        adc col
        sta ptr1
        bcc @same
        inc ptr1+1
@same:  ldy sch
        lda #<$0400
        ldx #>$0400
        jsr store
        ldy sch
        lda #<$3800
        ldx #>$3800
        jsr store
        ldy sink
        lda #<_color_a
        ldx #>_color_a
        jsr store
        ldy sink
        lda #<_color_b
        ldx #>_color_b
        jsr store
        ldy sink
        lda #<$D800
        ldx #>$D800
        jmp store

; ptr1 is the offset. A/X is the base. Y is the byte to store.
store:
        clc
        adc ptr1
        sta ptr2
        txa
        adc ptr1+1
        sta ptr2+1
        tya
        ldy #0
        sta (ptr2),y
        rts

bitlo:  .byte 1, 2, 4, 8, 16, 32, 64, 128, 0
bithi:  .byte 0, 0, 0, 0, 0, 0, 0, 0, 1
hx:     .byte 0, 7, 0, 7, 0, 7
hy:     .byte 0, 0, 6, 6, 11, 11
fcols:  .byte 2, 7, 1
ink:    .byte 2, 4, 3, 5

.segment "BSS"
covered_f:  .res 1
