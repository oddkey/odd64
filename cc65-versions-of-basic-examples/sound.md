Recreating the Commodore 64 User Guide code samples in cc65. Part four: Sound
===============================================================================

We are finally back after a long break! So lets go right down to business. Chapter 7 of the Commodore 64 Users Guide
describes how to program the SID registers in order to create sweet, delicious sound. The Commodore 64 SID chip one of
the most brilliant pieces of hardware to grace early home computers, developed by the stable genius Bob Yannes. The
achievements by some of the Commodore 64 game music creators, like Martin Galway, Rob Hubbard and Ben Dalish, made them
superstars in the day. Even today, pieces of SID tunes are finding their way into modern music.

Luckily, since my mission is to merely replicate the simple BASIC examples in the Users Guide into CC65 code, I don’t
have to go into the many, many complexities of the SID chip! So let’s take a look at the example named «Musical Scale»:

```basic
5 rem musical scale
7 for l=54272 to 54296: poke l,0:next
10 poke 54296,15: rem set volume
20 poke 54277,9: rem attack/decay voice 1
30 poke 54276,17: rem ctrl voice 1, triangle
40 for t = 1 to 300:next
50 read a
60 read b
70 if b=-1 then end
80 poke 54273,a: rem frequency voice 1
82 poke 54272,b: rem frequency voice 1
85 poke 54276,17: rem ctrl voice 1, triangle
90 for t=1 to 250:next
92 poke 54276,16: rem ctrl voice 1, stop
95 for t=1 to 50:next
100 goto 20
110 data 17,37,19,63,21,154,22,227
120 data 25,177,28,214,32,94,34,175
900 data -1,-1
```

The code is slightly rewritten with some extra REMarks. As usual, you may copy the text above, paste it into the VICE
emulator and type RUN to execute the code. This example simply plays the scale using one of the SID’s three voices,
using the triangle waveform. For the C version we’ll avoid using the POKE library, but instead we’ll use SID structs as
this will make the code slightly more readable. This requires that we import the c64 library:

```c
#include <stdio.h>
#include <stdlib.h>
#include <c64.h>

const int scale[] = {
0x1125,	0x133F,	0x159A,	0x16E3,
0x19B1, 0x1CD6,	0x205E,	0x22AF
};

int main (void) {
unsigned int i;
unsigned char t;

	SID.amp      = 0x1F; 	// Volume
	SID.v1.ad    = 0x09; 	// Attack/decay voice 1
	
	for (t = 0 ; t < sizeof(scale) / 2; t++) {
		SID.v1.freq  = scale[t];	// Frequency 
		SID.v1.ctrl  = 0x11;	// Control voice 1
		for (i = 0 ; i < 5000; i++) {}
		SID.v1.ctrl  = 0x10;
		for (i = 0 ; i < 1000 ; i++) {}
	}		
	return EXIT_SUCCESS;	
}
```

In the BASIC version, the scale data is defined in data statements as low byte/high byte values, while in the C version
the scale is defined as int values in which low/high bytes are combined as one value. In order to set the scale
frequency, only one operation is required in the C version:

```c
SID.v1.freq = scale[t];
```

Instead of:

```basic
80 poke 54273,a: rem frequency voice 1

82 poke 54272,b: rem frequency voice 1
```

Overall, the C version seems more human readable than the BASIC version. When you run these two version, you may notice
that the C version plays the scale faster than the BASIC version, but this is just a matter of adjusting the loop
parameters.

We’ll skip some of the other, minor BASIC examples in the Sound chapter and go to the example in which a small melody is
played:

```basic
2 for l=54272 to 54296:poke l,0:next
5 v=54296: w=54276:a=54277: hf=54273:lf=54272:s=54278:ph=54275:pl=54274
10 poke v,15:poke a,88:poke ph,15:poke pl,15:poke s,89
20 read h:if h=-1 then end
30 read l
40 read d
60 poke hf,h:poke lf,l:poke w,65
80 for t=1 to d:next:poke w,64
85 for t=1 to 50:next
90 goto 10
100 data 34,75,250,43,52,250,51,97,375,43,52,125,51,97
105 data 250,57,172,250
110 data 51,97,500,0,0,125,43,52,250,51,97,250,57,172
115 data 1000,51,97,500
120 data -1,-1,-1
```

This is actually quite similar to the scale example. The difference being additional data that defines the length of
each tone being played. Also, since the waveform is set to «pulse», a pulse width must be defined. So let’s see how the
C version may look like:

```c
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
```

Now let’s tweak this example a bit, let’s add the two remaining SID voices and play around with the pulse width to
produce a more interesting soundscape. The tweaking of the pulse width would be hard to achieve using BASIC, but the
extra speed provided by the compiled C code allows for some neat tricks.

```c
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
unsigned char t, r, song_length = sizeof(song) / 2;
unsigned int pw = 0;
char pw_dir = 1;

	SID.v1.ad    = 0x58; 	// Attack/decay voice 1
	SID.v1.sr    = 0x59; 	// Sustain/release voice 1
	SID.v2.ad    = 0xaa; 	// Attack/decay voice 2
	SID.v2.sr    = 0xaa; 	// Sustain/release voice 2
	SID.v3.ad    = 0xaa; 	// Attack/decay voice 3
	SID.v3.sr    = 0xaa; 	// Sustain/release voice 3
	SID.amp      = 0x1F; 	// Volume
	
	for (r = 0 ; r < 2 ; r++) {
		for (t = 0 ; t < song_length ; t += 2) { 			SID.v1.freq  = song[t];	// Frequency  			SID.v1.ctrl  = 0x41;	// Control voice 1 			SID.v2.freq  = song[t] >> 1;	// Frequency 
			SID.v2.ctrl  = 0x11;	// Control voice 2
			SID.v3.freq  = song[t] << 1;	// Frequency 
			SID.v3.ctrl  = 0x41;	// Control voice 3
			for (i = 0 ; i < song[t + 1] * 3; i++) {
				SID.v1.pw = pw;
				SID.v3.pw = 0xFFFF - pw;
				pw += pw_dir;
				if (pw == 0xFFFF || pw == 0) {
					pw_dir = -pw_dir;
				}
			}
			SID.v1.ctrl  = 0x40;
			SID.v2.ctrl  = 0x10;
			SID.v3.ctrl  = 0x40;
			for (i = 0 ; i < 1000 ; i++) {}
		}				
	}
	return EXIT_SUCCESS;	
}
```

Now, if you’d ever like to create music or sound effects for a game using CC65, you would definitely not use waiting
loops like in these examples in order to create pauses between the notes or for prolonging a tone. This would waste a
lot of valuable CPU time! Game music code is usually run as interrupt routines, in which minuscule CPU time can be
allocated for changing frequencies etc before returning to the main program. Unfortunately, the CC65 library is not very
helpful when it comes to writing interrupt based code, so you’ll probably have to rely on some inline assembly code to
get the job done, as this documentation suggests.

This part is missing quite a few minor sound code examples from the Sound chapter. But they should be fairly easy to
replicate using the C examples above as templates. Just keep in mind that the code may run so fast that you might not
even be able to hear the sounds, so you may need to implement those annoying waiting loops. 😉

Alright, I think I’ll finish here. There are still more BASIC examples in the Users Guide that I haven’t covered. I may
try to replicate some of these in C code in the unlikely case of high demand. We’ll see. Cheerio for now!

The first part of this exciting adventure can be found [here](colorbars.md).
