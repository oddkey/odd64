CL65 ?= cl65
VICE ?= flatpak run --command=x64sc net.sf.VICE

TARGET = maze.prg
SRCS   = src/main.c src/scroll.s src/sprites.s src/actors.s src/sound.s src/bomb.s src/foes.s src/title_screen.s

.PHONY: all clean run

all: $(TARGET)

$(TARGET): $(SRCS) maze.cfg
	$(CL65) -t c64 -O -C maze.cfg -o $(TARGET) -m maze.map -Ln maze.lbl $(SRCS)

run: $(TARGET)
	$(VICE) -sound -VICIIfilter 0 -autostartprgmode 1 +confirmonexit -autostart $(CURDIR)/$(TARGET)

clean:
	rm -f $(TARGET) maze.map maze.lbl src/*.o
