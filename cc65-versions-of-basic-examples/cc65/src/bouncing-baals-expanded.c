// bouncing-balls-expanded.c
#include <stdio.h>
#include <stdlib.h>
#include <peekpoke.h>
#include <time.h>

#define BALL_COUNT 10

int v = 0xD000;	// START OF DISPLAY CHIP
int x[BALL_COUNT], y[BALL_COUNT];
int dx[BALL_COUNT], dy[BALL_COUNT];

// Need wait function to slow down loop
void rasterWait(void) {
	unsigned char raster;
	do {
		raster = PEEK(v + 18);
	} while (raster < 250 || raster > 252);
}

// Add to x coordinate and check if inside screen boundaries
void addX(ballNo) {
	x[ballNo] += dx[ballNo];
	if (x[ballNo] < 0 || x[ballNo] > 39) {
		dx[ballNo] = -dx[ballNo];
		addX(ballNo);
	}
}

// Add to y coordinate and check if inside screen boundaries
void addY(ballNo) {
	y[ballNo] += dy[ballNo];
	if (y[ballNo] < 0 || y[ballNo] > 24) {
		dy[ballNo] = -dy[ballNo];
		addY(ballNo);
	}
}

// Check if ball has collided with background
void checkBackgroundCollision(ballNo) {
	if (PEEK(1024 + x[ballNo] + 40 * y[ballNo]) != 32) {
		// If collision, bounce back in either x or y direction
		if (rand() % 2 == 0) {
			dx[ballNo] = -dx[ballNo];
			addX(ballNo);
		} else {
			dy[ballNo] = -dy[ballNo];
			addY(ballNo);
		}
	}
}

// Initialize ball data
void initBalls() {
	int ballNo;
	for (ballNo = 0 ; ballNo < BALL_COUNT ; ballNo++) {
		x[ballNo] = rand() % 40;
		if (x[ballNo] < 20) {
			dx[ballNo] = 1;
		} else {
			dx[ballNo] = -1;
		}
		y[ballNo] = rand() % 24;
		if (y[ballNo] < 12) {
			dy[ballNo] = 1;
		} else {
			dy[ballNo] = -1;
		}
	}
}

int main (void) {
	int l, oldPos, ballNo;
	srand(time(NULL));
	initBalls();
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
		for (ballNo = 0 ; ballNo < BALL_COUNT ; ballNo++) {
			oldPos = 1024 + x[ballNo] + 40 * y[ballNo];
			addX(ballNo);
			addY(ballNo);
			checkBackgroundCollision(ballNo);
			POKE(1024 + x[ballNo] + 40 * y[ballNo], 81);
			POKE(oldPos, 32); // Clear last position
		}
	} while (1);

    return EXIT_SUCCESS;
}