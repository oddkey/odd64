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