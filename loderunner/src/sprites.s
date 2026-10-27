; Runner frames, drawn to sit inside one 10x10 block.
; Order: run, run, climb, rope. Column 4 of the sprite is the
; left edge of the block.
.segment "SPRITES"
.export _sprites
_sprites:
        .byte 3,128,0,7,128,0,3,128
        .byte 0,7,192,0,3,128,0,2
        .byte 128,0,4,64,0,8,32,0
        .byte 0,32,0,0,64,0,0,0
        .byte 0,0,0,0,0,0,0,0
        .byte 0,0,0,0,0,0,0,0
        .byte 0,0,0,0,0,0,0,0
        .byte 0,0,0,0,0,0,0,0
        .byte 3,128,0,7,128,0,3,128
        .byte 0,7,192,0,3,128,0,3
        .byte 128,0,1,0,0,2,128,0
        .byte 2,128,0,4,64,0,0,0
        .byte 0,0,0,0,0,0,0,0
        .byte 0,0,0,0,0,0,0,0
        .byte 0,0,0,0,0,0,0,0
        .byte 0,0,0,0,0,0,0,0
        .byte 4,64,0,6,192,0,7,192
        .byte 0,3,128,0,3,128,0,5
        .byte 64,0,4,64,0,4,64,0
        .byte 4,64,0,4,64,0,0,0
        .byte 0,0,0,0,0,0,0,0
        .byte 0,0,0,0,0,0,0,0
        .byte 0,0,0,0,0,0,0,0
        .byte 0,0,0,0,0,0,0,0
        .byte 1,0,0,3,128,0,6,128
        .byte 0,3,128,0,3,128,0,2
        .byte 128,0,2,128,0,2,64,0
        .byte 2,32,0,2,32,0,0,0
        .byte 0,0,0,0,0,0,0,0
        .byte 0,0,0,0,0,0,0,0
        .byte 0,0,0,0,0,0,0,0
        .byte 0,0,0,0,0,0,0,0
