#include <stdio.h>
#include <stdlib.h>
#include <c64.h>

const int song[] = {
0x224B, 0x00FA,	0x2B34, 0x00FA,	0x3361, 0x0177,
0x2b35, 0x007D,	0x3361, 0x00FA, 0x39AC, 0x00FA,
0x3361, 0x01F4,	0x0000, 0x007D,	0x2B34, 0x00FA,
0x3461, 0x00FA,	0x39AC, 0x03E8, 0x3361, 0x01F4
};

int main (void) {
unsigned int i;
unsigned char t, song_length = sizeof(song) / 2;

	SID.v1.ad    = 0x58; 	// Attack/decay voice 1
	SID.v1.sr    = 0x59; 	// Sustain/release voice 1
	SID.amp      = 0x1F; 	// Volume
	SID.v1.pw	 = 0x0F0F; 	// Pulse width voice 1

	for (t = 0 ; t < song_length ; t += 2) {
		SID.v1.freq  = song[t];	// Frequency
		SID.v1.ctrl  = 0x41;	// Control voice 1
		for (i = 0 ; i < song[t + 1] * 3; i++) {}
		SID.v1.ctrl  = 0x40;
		for (i = 0 ; i < 1000 ; i++) {}
	}
	return EXIT_SUCCESS;
}