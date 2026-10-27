# Bomb Jack, board one

A cc65 game for the Commodore 64. The picture is the first board: the sphinx and the pyramid, five platforms, and the twenty-two bombs laid out the way they sit on that screen. Jack runs and jumps. The two white robots walk the pyramid ledge and the lower ledge.

The drawing is original, made to the measure of that board and packed into a multicolor bitmap. It is not graphics lifted from the arcade ROMs.

## Play

Jack starts on the upper platform. Left and right make him run. Fire or the space bar jumps. Hold the button to jump higher, and hold up at the same time to reach the top of the board. He falls after the jump. Tap the button once while he is rising and the rise stops. Tap it repeatedly while he is falling and he drifts down. Hold down to drop through the platforms to the bottom. He lands when a slow fall meets the top of a platform. One bomb flashes. Taking that one scores 200 and doubles the badge, up to x64. Any other bomb scores 100 and puts the badge back to x1. Clearing the board scores an extra 1000 and lays the bombs out again. A robot costs a life. The last life ends the round; fire or the space bar starts it over. The high score stays.

## Build

cc65 (`cl65`) and Python 3 need to be on `PATH`.

```
cd bombjack
make
```

This writes `bombjack.prg`. `tools/makeboard.py` rebuilds the bitmap, the sprite pictures and `src/hud.inc` first.

## Run

With VICE installed as a Flatpak:

```
make run
```

Or point any C64 emulator at `bombjack.prg`.

## Controls

- Joystick in port 1 or port 2
- `W` `A` `S` `D`
- Fire or the space bar jumps, and either one restarts after GAME OVER
