; Runner, stride, climb, and rope, then the same four facing right.
; The pictures sit in the left of the 24-pixel sprite. Facing right
; is that picture mirrored inside the same nine pixels, so the body
; stays in the 10-pixel column.
.segment "SPRITES"
.export _sprites
_sprites:
        ; left run
        .byte 16,0,0,56,0,0,56,0
        .byte 0,24,0,0,94,0,0,123
        .byte 0,0,24,0,0,60,0,0
        .byte 102,0,0,99,0,0,3,0
        .byte 0,0,0,0,0,0,0,0
        .byte 0,0,0,0,0,0,0,0
        .byte 0,0,0,0,0,0,0,0
        .byte 0,0,0,0,0,0,0,0
        ; left stride
        .byte 16,0,0,56,0,0,56,0
        .byte 0,24,0,0,94,0,0,123
        .byte 0,0,24,0,0,108,0,0
        .byte 198,0,0,131,0,0,64,0
        .byte 0,0,0,0,0,0,0,0
        .byte 0,0,0,0,0,0,0,0
        .byte 0,0,0,0,0,0,0,0
        .byte 0,0,0,0,0,0,0,0
        ; left climb
        .byte 24,0,0,24,128,0,31,128
        .byte 0,156,0,0,252,0,0,28
        .byte 0,0,28,0,0,54,0,0
        .byte 55,0,0,48,0,0,112,0
        .byte 0,0,0,0,0,0,0,0
        .byte 0,0,0,0,0,0,0,0
        .byte 0,0,0,0,0,0,0,0
        .byte 0,0,0,0,0,0,0,0
        ; left rope
        .byte 8,0,0,28,0,0,46,0
        .byte 0,28,0,0,28,0,0,20
        .byte 0,0,20,0,0,18,0,0
        .byte 17,0,0,17,0,0,0,0
        .byte 0,0,0,0,0,0,0,0
        .byte 0,0,0,0,0,0,0,0
        .byte 0,0,0,0,0,0,0,0
        .byte 0,0,0,0,0,0,0,0
        ; right run
        .byte 4,0,0,14,0,0,14,0
        .byte 0,12,0,0,61,0,0,111
        .byte 0,0,12,0,0,30,0,0
        .byte 51,0,0,99,0,0,96,0
        .byte 0,0,0,0,0,0,0,0
        .byte 0,0,0,0,0,0,0,0
        .byte 0,0,0,0,0,0,0,0
        .byte 0,0,0,0,0,0,0,0
        ; right stride
        .byte 4,0,0,14,0,0,14,0
        .byte 0,12,0,0,61,0,0,111
        .byte 0,0,12,0,0,27,0,0
        .byte 49,128,0,96,128,0,1,0
        .byte 0,0,0,0,0,0,0,0
        .byte 0,0,0,0,0,0,0,0
        .byte 0,0,0,0,0,0,0,0
        .byte 0,0,0,0,0,0,0,0
        ; right climb
        .byte 12,0,0,140,0,0,252,0
        .byte 0,28,128,0,31,128,0,28
        .byte 0,0,28,0,0,54,0,0
        .byte 118,0,0,6,0,0,7,0
        .byte 0,0,0,0,0,0,0,0
        .byte 0,0,0,0,0,0,0,0
        .byte 0,0,0,0,0,0,0,0
        .byte 0,0,0,0,0,0,0,0
        ; right rope
        .byte 8,0,0,28,0,0,58,0
        .byte 0,28,0,0,28,0,0,20
        .byte 0,0,20,0,0,36,0,0
        .byte 68,0,0,68,0,0,0,0
        .byte 0,0,0,0,0,0,0,0
        .byte 0,0,0,0,0,0,0,0
        .byte 0,0,0,0,0,0,0,0
        .byte 0,0,0,0,0,0,0,0
