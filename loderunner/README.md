# Lode Runner, one screen

A cc65 game for the Commodore 64. One level, laid out from a play of the original: bricks, ladders, ropes, six piles of gold, and three guards. The runner digs the floor, the guards chase, and the way out is the top of the screen once the gold is gone.

Bricks, ladders, ropes and gold are drawn as blocks 10 pixels wide and 11 pixels tall in a multicolor bitmap. Each block is five multicolor pixels wide, and each of those pixels is two hires dots, so the block still covers 10 pixels across. The brick picture fills the first 10 rows, and the 11th row is the gap before the next one. Under the floor is a four-pixel bar, not another tile, and the status line sits below that. The board is 28 columns, inset 20 pixels from each side of the screen. The runner and the guards are hires sprites, and they turn to face the way they are walking. The drawings are original. The gif was only used to read the board. A hardware cell can keep the black background plus three inks, so a brick, a ladder and a pile of gold that share a cell each keep their own color. The status line uses the same 10-pixel columns, so each letter lines up with a column of bricks.

## Play

The runner starts on the floor. Left and right walk. Up and down climb a ladder, and up will not leave the top while any gold is left. On a rope, left and right shimmy and down lets go. Fire with left or right digs the brick beside your feet. A hole stays open for a short while. A guard who is still in it when the brick returns is removed and comes back from his start. Fall in yourself and climb out before it closes, or the brick takes a life. Touching a guard also costs a life. Gold is 250. With every pile taken, climb off the top ladder to finish the level. The same board comes back, and the score stays. Five men. The last one ends the round; fire or the space bar starts it over.

## Build

cc65 (`cl65`) needs to be on `PATH`.

```
cd loderunner
make
```

This writes `loderunner.prg`.

## Run

With VICE installed as a Flatpak:

```
make run
```

Or point any C64 emulator at `loderunner.prg`.

## Controls

- Joystick in port 1 or port 2
- `W` `A` `S` `D`
- Fire or the space bar, held with left or right, digs
- Fire or the space bar restarts after GAME OVER
