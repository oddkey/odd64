CL65 ?= cl65
VICE ?= flatpak run --command=x64sc net.sf.VICE
PYTHON ?= python3

TARGET = bombjack.prg
GEN    = src/board.s src/hud.inc
SRCS   = src/main.c src/board.s

.PHONY: all clean run preview

all: $(TARGET)

$(GEN): tools/makeboard.py
	$(PYTHON) tools/makeboard.py

$(TARGET): $(SRCS) src/hud.inc bombjack.cfg
	$(CL65) -t c64 -O -I src -C bombjack.cfg -o $(TARGET) -m bombjack.map -Ln bombjack.lbl $(SRCS)

preview: $(GEN)

run: $(TARGET)
	$(VICE) -sound -VICIIfilter 0 -autostartprgmode 1 +confirmonexit -autostart $(CURDIR)/$(TARGET)

clean:
	rm -f $(TARGET) bombjack.map bombjack.lbl src/*.o $(GEN) preview.png
