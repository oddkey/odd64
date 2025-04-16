#include <stdio.h>
#include <stdlib.h>
#include <conio.h>
#include <peekpoke.h>

const char sprite[] = {
0,127,0,1,255,192,3,255,224,3,231,224,
7,217,240,7,223,240,7,217,240,3,231,224,
3,255,224,3,255,224,2,255,160,1,127,64,
1,62,64,0,156,128,0,156,128,0,73,0,0,73,0,
0,62,0,0,62,0,0,62,0,0,28,0
};

int v = 0xD000; // START OF DISPLAY CHIP

// Need wait function to slow down x loop
void rasterWait(void) {
unsigned char raster;
do {
raster = PEEK(v + 18);
} while (raster < 250 || raster > 252);
}

int main (void)
{
unsigned char n;
unsigned char x;
unsigned char t;
printf ("%c", 147);
POKE(v + 21, 28); // ENABLE SPRITE 2, 3, 4
POKE(2042, 13); // SPRITE 2 DATA FROM 13TH BLK
POKE(2043, 13); // SPRITE 3 DATA FROM 13TH BLK
POKE(2044, 13); // SPRITE 4 DATA FROM 13TH BLK

	for (n = 0 ; n < sizeof(sprite) ; n++) {
		POKE(832 + n, sprite[n]);
	}
	POKE(v + 23, 12); // Expand sprite 2, 4 x direction
	POKE(v + 29, 12); // Expand sprite 2, 4 y direction

	do {
		for (x = 1 ; x <= 190; x++) {
			POKE(v + 4, x); 		// UPDATE X COORDINATES
			POKE(v + 6, x);
			POKE(v + 8, x);
			POKE(v + 5, x); 		// UPDATE Y COORDINATES
			POKE(v + 7, 190 - x);
			POKE(v + 9, 100);
			rasterWait();
		}
	} while (1);
    return EXIT_SUCCESS;

}