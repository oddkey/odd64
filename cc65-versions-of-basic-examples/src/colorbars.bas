1 rem automatic color bars
5 print chr$(147) : rem chr$(147) = clr/home
10 print chr$(18); "     ";
20 cl = int(8*rnd(1))+1
30 on cl goto 40,50,60,70,80,90,100,110
40 print chr$(5);: goto 10
50 print chr$(28);: goto 10
60 print chr$(30);: goto 10
70 print chr$(31);: goto 10
80 print chr$(144);: goto 10
90 print chr$(156);: goto 10
100 print chr$(158);: goto 10
110 print chr$(159);: goto 10