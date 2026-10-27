CL65 ?= cl65
VICE ?= flatpak run --command=x64sc net.sf.VICE

TARGET = loderunner.prg
SRCS   = src/main.c src/video.s src/sprites.s

.PHONY: all clean run

all: $(TARGET)

$(TARGET): $(SRCS) loderunner.cfg
	$(CL65) -t c64 -O -C loderunner.cfg -o $(TARGET) -m loderunner.map -Ln loderunner.lbl $(SRCS)

run: $(TARGET)
	$(VICE) -sound -VICIIfilter 0 -autostartprgmode 1 +confirmonexit -autostart $(CURDIR)/$(TARGET)

clean:
	rm -f $(TARGET) loderunner.map loderunner.lbl src/*.o
