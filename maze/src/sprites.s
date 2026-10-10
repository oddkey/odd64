; Four hires frames of a small man, 8 pixels wide and 12 tall,
; packed into the top of a 24x21 sprite. Each frame is 64 bytes
; and the segment is placed at $0840 (VIC sprite block 33).
;
;   right step A     right step B
;   ..####..         ..####..
;   .##..##.         .##..##.
;   .##..##.         .##..##.
;   ..####..         ..####..
;   ...##...         ...##...
;   ..####..         ..####..
;   ...####.         ...####.
;   ...##...         ...##...
;   ...##...         ..##....
;   ..#..#..         ...#.#..
;   ..#..#..         ...#..#.
;   .##..##.         ...#..##

; Copied to $3C00 at runtime (sprite block 240). That address is
; in VIC bank 0, above both screen matrices.
.segment "SPRITES"

.export _sprite_frames
_sprite_frames:

; Right, step A
.byte $3C, $00, $00
.byte $66, $00, $00
.byte $66, $00, $00
.byte $3C, $00, $00
.byte $18, $00, $00
.byte $3C, $00, $00
.byte $1E, $00, $00
.byte $18, $00, $00
.byte $18, $00, $00
.byte $24, $00, $00
.byte $24, $00, $00
.byte $66, $00, $00
.res  28, $00

; Right, step B
.byte $3C, $00, $00
.byte $66, $00, $00
.byte $66, $00, $00
.byte $3C, $00, $00
.byte $18, $00, $00
.byte $3C, $00, $00
.byte $1E, $00, $00
.byte $18, $00, $00
.byte $30, $00, $00
.byte $14, $00, $00
.byte $12, $00, $00
.byte $13, $00, $00
.res  28, $00

; Left, step A
.byte $3C, $00, $00
.byte $66, $00, $00
.byte $66, $00, $00
.byte $3C, $00, $00
.byte $18, $00, $00
.byte $3C, $00, $00
.byte $78, $00, $00
.byte $18, $00, $00
.byte $18, $00, $00
.byte $24, $00, $00
.byte $24, $00, $00
.byte $66, $00, $00
.res  28, $00

; Left, step B
.byte $3C, $00, $00
.byte $66, $00, $00
.byte $66, $00, $00
.byte $3C, $00, $00
.byte $18, $00, $00
.byte $3C, $00, $00
.byte $78, $00, $00
.byte $18, $00, $00
.byte $0C, $00, $00
.byte $28, $00, $00
.byte $48, $00, $00
.byte $C8, $00, $00
.res  28, $00

; One ghost, copied to $3D00 (sprite block 244). Same 8x12 box as the man.
.export _ghost_sprite
_ghost_sprite:
.byte $3C, $00, $00
.byte $7E, $00, $00
.byte $DB, $00, $00
.byte $FF, $00, $00
.byte $FF, $00, $00
.byte $FF, $00, $00
.byte $FF, $00, $00
.byte $FF, $00, $00
.byte $7E, $00, $00
.byte $DB, $00, $00
.byte $49, $00, $00
.byte $00, $00, $00
.res  28, $00
