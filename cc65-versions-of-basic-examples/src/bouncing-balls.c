// bouncing-balls.c
#include <stdio.h>
#include <stdlib.h>
#include <peekpoke.h>
#include <time.h>

int v = 0xD000;	// START OF DISPLAY CHIP
int x = 1, y = 1;
int dx = 1, dy = 1;

// Need wait function to slow down loop
void rasterWait(void) {
	unsigned char raster;
	do {
		raster = PEEK(v + 18);
	} while (raster < 250 || raster > 252);
}

// Add to x coordinate and check if inside screen boundaries
void addX() {
	x += dx;
	if (x < 0 || x > 39) {
		dx = -dx;
		addX();
	}
}

// Add to y coordinate and check if inside screen boundaries
void addY() {
	y += dy;
	if (y < 0 || y > 24) {
		dy = -dy;
		addY();
	}
}

// Check if ball has collided with collision object
void checkBackgroundCollision() {
	if (PEEK(1024 + x + 40 * y) == 166) {
		// If collision, bounce back in either x or y direction
		if (rand() % 2 == 0) {
			dx = -dx;
			addX();
		} else {
			dy = -dy;
			addY();
		}
	}
}

int main (void) {
	int l, oldPos;
	srand(time(NULL));
	printf ("%c", 147);
	POKE(v + 24,21); // Set upper case
	POKE(v + 32, 7); // Set border color
	POKE(v + 33, 13); // Set background color
	// Put collision objects in random locations
	for (l = 0 ; l < 10 ; l++) {
		POKE(1024 + rand() % 1000, 166);
	}
	do {
		rasterWait();
		oldPos = 1024 + x + 40 * y;
		addX();
		addY();
		checkBackgroundCollision();
		POKE(1024 + x + 40 * y, 81);
		POKE(oldPos, 32); // Clear last position
	} while (1);

    return EXIT_SUCCESS;
}