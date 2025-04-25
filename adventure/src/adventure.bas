;#LANG "qb"
1 rem ******************
2 rem * adventure game *
3 rem * (c) 2025 oko   *
4 rem ******************
5 cs=4:dim co(cs+1)
6 for i=0 to cs:read co(i):next
10 wl=0:dim wo$(4):rem input words
15 pl=5:dim pr$(pl):rem prompts
29 rem * rooms *
30 rh=5:rw=5:dim ro$(rh,rw,7):dim rd(rh,rw)
34 rem * objects *
35 ol=34:rem no. of objects
36 rem description, positions
37 dim ob$(ol,2):dim op(ol,2)
38 rem object type, weapon strength
39 dim ot(ol):dim os(ol)
42 il=5:rem max inventory length
43 rem * actors, 0 is player *
45 an=-1:al=13:wr=-1
46 rem description, positions, health
47 dim ad$(al,3):dim ap(al,2):dim ah(al)
50 rem inventory, inv. count, carrying
51 dim ai(al,il):dim ic(al):dim ac(al)
55 cl=15:dim co$(cl,3):rem commands
59 rem trades, texts, trade objects (actor-to-from)
60 tl=11:dim tt$(tl):dim tr(tl,2)
61 sl=13:dim si$(sl,6):dim sy(sl):dim sx(sl):rem signs
70 gosub 29000:rem initial colors
75 gosub 10000:rem setup game
80 gosub 30000:rem welcome text
85 gosub 5000:rem display location
100 rem *******************
101 rem * main loop start *
102 rem *******************
105 print:print pr$(int(rnd(1)*5));
110 input in$
120 gosub 4500:rem split into word array
130 if wl=0 goto 100
140 gosub 9000:rem get command #
150 if c=-1 goto 100:rem unknown command
160 on c gosub 1000,1100,1200,1300,1500,1600,1900,2000,2200,2300,2500,2700,2900
165 if c>12 then c=c-13:on c gosub 3400,3500
170 gosub 7000:rem other actors actions
180 if ah(0)<=0 then print:print">>>> Game over!!! <<<<":end
999 goto 100:rem loop back to start
1000 rem ******************
1001 rem * "help" command *
1002 rem ******************
1010 print"Commands:"
1020 for ci=0 to cl-1:print co$(ci,0)+" / "+co$(ci,1)+" "+co$(ci,2):next
1025 print"The 'use' command can be used to hold a"+cr$
1026 print"weapon, wear something or use a usable object."
1030 return
1100 rem ******************
1101 rem * "look" command *
1102 rem ******************
1160 gosub 5000:rem display location
1170 return
1200 rem ***********************
1201 rem * "inventory" command *
1202 rem ***********************
1250 print:print"You have:"
1256 if ic(0)=0 then print"Nothing":goto 1270
1260 for i=0 to ic(0)-1:print" - ";ob$(ai(0,i),1):next
1265 if ac(0)<>-1 then print"You are holding the "+ob$(ac(0),0)
1266 if wr<>-1 then print"You are wearing "+ob$(wr,1)
1270 print:if ah(0)<10 then print"{red}You are badly hurt!{gry1}"
1271 if ah(0)>=10 and ah(0)<30 then print"{lred}You are injured!{gry1}"
1272 if ah(0)>=30 and ah(0)<50 then print"You are feeling fine."
1273 if ah(0)>=50 then print"You are in excellent health!"
1299 return
1300 rem *****************
1301 rem * "dig" command *
1302 rem *****************
1303 gosub 4700:rem dark?
1304 if da=1 then print "Can't dig in darkness, man!":return
1305 fo=0:if ic(0)=0 then goto 1309
1306 for i=0 to ic(0)-1
1307 if ai(0,i)=11 then fo=1
1308 next
1309 if fo=0 then print"You have nothing to dig with!":return
1310 if not (ap(0,0)=3 and ap(0,1)=2 and op(23,0)=-1) goto 1350
1320 print"You found something buried in the field!"
1330 op(23,0)=ap(0,0):op(23,1)=ap(0,1)
1340 return
1350 if not (ap(0,0)=4 and ap(0,1)=4 and op(17,0)=-1) goto 1499
1360 print"You found a golden chest buried in the sand!"
1370 op(17,0)=ap(0,0):op(17,1)=ap(0,1)
1380 return
1499 print"You found nothing interesting":return
1500 rem ******************
1501 rem * "quit" command *
1502 rem ******************
1510 input "Quit? Are you sure (y/n)";a$
1520 if a$<>"y" then return
1530 print"Goodbye!":end
1600 rem ******************
1601 rem * "take" command *
1602 rem ******************
1604 gosub 4700:rem is dark?
1605 if da=1 then print"Dude, take what!? It's dark!":return
1610 nq$=w2$:gosub 6200:rem is peron?
1620 if an<>-1 then print"The ";nq$;" refuses to be taken!":return
1625 if w2$<>"sign" then 1630
1626 gosub 5400:rem is sign here?
1627 if ii<>-1 then print"The sign is really stuck!":return
1630 an=0:oq$=w2$:gosub 6100:rem is object here?
1640 if o=-1 then return:rem nope!
1650 if ot(o)=12 then print"The ";oq$;" is too heavy!":return
1700 if ic(0)>il-1 then print"Your inventory is full!":return
1800 print"You took ";ob$(o,1)
1810 ai(0,ic(0))=o:rem set inventory object
1811 ic(0)=ic(0)+1:rem increase inventory count
1812 op(o,0)=-1:op(o,1)=-1:rem clear object positions
1899 return
1900 rem ******************
1901 rem * "drop" command *
1902 rem ******************
1904 rem object in inventory?
1905 iq$=wo$(1):an=0:gosub 6000
1910 if ii=-1 then return:rem nope!
1950 o=ai(0,ii)
1955 rem put object in location
1960 op(o,0)=ap(0,0):op(o,1)=ap(0,1)
1970 rem remove object from inventory
1980 gosub 5500
1990 print"You dropped the "+ob$(o,1)
1999 return
2000 rem ******************
2001 rem * "give" command *
2002 rem ******************
2005 gosub 4700:rem is dark?
2006 if da=1 then print"You can't see anyone!":return
2010 if wo$(2)="" or wo$(3)="" then print"To who?":return
2020 if wo$(2)<>"to" then print"I don't understand":return
2030 an=0:iq$=w2$:gosub 6000:rem object in inventory?
2040 if ii=-1 then return:rem nope!
2045 mi=ii
2050 nq$=wo$(3):gosub 6200:rem is actor here?
2060 if an=-1 then print"There is no "+nq$+" here!":return
2065 fo=0:t=0
2069 rem loop through trades, check match
2070 if not (an=tr(t,0) and tr(t,1)=ai(0,mi)) then goto 2078
2071 o=tr(t,2):gosub 6050:rem actor has trade item?
2072 if ii=-1 then 2090:rem nope!
2073 print tt$(t):ai(0,mi)=tr(t,2):ai(an,ii)=tr(t,1):fo=1:rem yes!
2074 print "The "+nq$+" gave you "+ob$(ai(0,mi),1)
2075 if ac(0)=tr(t,1) then ac(0)=-1
2078 t=t+1:if t<tl and fo=0 then 2070
2079 if fo=1 then return
2080 print"The ";nq$;" is not interested in the ";iq$:return
2090 rem actor takes your item without giving back
2093 print"The ";nq$;" takes the ";iq$
2094 ai(an,ic(an))=ai(0,mi):ic(an)=ic(an)+1
2096 rem remove your given item
2097 ii=mi:an=0:gosub 5500:rem remove item you gave
2098 if ic(10)=5 then 33000:rem bank has all treasures?
2199 return
2200 rem *****************
2201 rem * "use" command *
2202 rem *****************
2205 iq$=w2$:an=0
2210 gosub 6000:rem object in inventory?
2215 if ii=-1 then return:rem nope!
2220 o=ai(0,ii)
2225 on ot(o) goto 3430,3530,2260,2270,2280
2230 ac(0)=o
2231 rem use=holding
2232 print"You're holding the "+ob$(ac(0),0):return
2260 rem use=listen to walkman 
2261 print"You listen to a mixtape with your"
2262 print"favourite artists: Prince, Michael"
2263 print"Jackson, David Bowie, Queen. These guys"
2264 print"will live forever, you imagine!"
2269 return
2270 rem use=wear
2271 wr=o:print"You are now wearing ";ob$(wr,1):return
2280 print"You could never solve this damn thing!":return
2300 rem ******************
2301 rem * "open" command *
2302 rem ******************
2303 gosub 4700:rem dark?
2304 if da=1 then print"Open what!? It's dark!!":return
2305 nq$=w2$:gosub 6200:rem is person?
2306 if an<>-1 then print"You can't open the ";nq$:return
2310 an=0:oq$=w2$:gosub 6100:rem is object here?
2320 if o=-1 then return:rem nope!
2325 uo=o
2330 if uo<>18 goto 2400:rem silver chest?
2335 an=0:o=26:gosub 6050:rem has silver key?
2340 if ii=-1 then return
2350 o=21:goto 2490
2400 if uo<>17 goto 2450:rem golden chest?
2410 an=0:o=4:gosub 6050:rem has golden key?
2415 if ii=-1 then return
2430 o=22:goto 2490
2450 if uo<>29 goto 2499
2460 an=0:o=28:gosub 6050:rem has town key?
2470 if ii=-1 then return
2480 print"You unlocked the gate!":rd(1,2)=rd(1,2)+e
2481 print"A squirrel appeared and took the key!"
2482 gosub 5500:return
2490 print"You unlocked the ";ob$(uo,0);". It contains ";ob$(o,1);"!"
2495 op(o,0)=ap(0,0):op(o,1)=ap(0,1):
2496 print"A bird swooped down and grabbed the key!"
2498 gosub 5500:return
2499 print"You can't unlock "+ob$(o,1):return
2500 rem ******************
2501 rem * "read" command *
2502 rem ******************
2503 gosub 4700:rem is dark?
2504 if da=1 then print"Can't read in the dark!":return
2505 an=0:iq$=wo$(1)
2506 if iq$<>"sign" then 2510
2507 gosub 5400:rem is sign here?
2508 if ii=-1 then print"There's no sign here, dummy!":return
2509 gosub 5450:return:rem print sign
2510 gosub 6000:rem object in inventory?
2520 if ii=-1 then return:rem nope!
2524 rem get object # from inventory index
2525 o=ai(0,ii)
2530 if o<>7 then 2570
2540 print"The book contains a story about a"
2550 print"beautiful princess that fought a troll"
2560 print"and saved the brave knight!"
2565 return
2570 if o<>1 then 2699
2580 print"According to this map, captain"
2590 print"Bloodnose buried his treasure at the"
2600 print"beach by the cliffs!":return
2699 print"There's no text on ";ob$(o,1):return
2700 rem ******************
2701 rem * "kill" command *
2702 rem ******************
2703 gosub 4700:rem dark?
2704 if da=1 then print "Can't kill someone you can't see!":return
2705 if ac(0)=-1 and (wo$(2)="" or wo$(3)="") then print"With what?":return
2706 if ac(0)=-1 and wo$(2)<>"with" then print"I don't understand":return
2707 nq$=w2$:gosub 6200:rem is actor here?
2708 if an=-1 then print"There is no "+nq$+" here!":return:rem nope!
2709 ta=an:rem ta=target actor #
2710 if ac(0)<>-1 then o=ac(0):goto 2770:rem object in hand
2720 iq$=wo$(3):an=0
2730 gosub 6000:rem object in inventory?
2740 if ii=-1 then return:rem nope!
2760 o=ai(0,ii):rem obj # from inventory
2770 if ta=1 then print"He laughs at your feeble attack!":return
2780 an=0:gosub 8000:rem attack
2899 return
2900 rem ****************
2901 rem * "go" command *
2902 rem ****************
2910 if w2$="w" or w2$="west" then gosub 3000:return
2920 if w2$="e" or w2$="east" then gosub 3100:return
2930 if w2$="n" or w2$="north" then gosub 3200:return
2940 if w2$="s" or w2$="south" then gosub 3300:return
2950 print"Unable to go "+w2$
2960 return
3000 rem *****************
3001 rem * check go west *
3002 rem *****************
3010 if (rd(ap(0,0), ap(0,1)) and w)=w goto 3030
3020 print"Unable to go west":return
3030 ap(0,1)=ap(0,1)-1
3040 print"You went west"
3050 gosub 5000:return
3100 rem *****************
3101 rem * check go east *
3102 rem *****************
3110 if (rd(ap(0,0), ap(0,1)) and e)=e goto 3140
3120 print"Unable to go east":return
3140 ap(0,1)=ap(0,1)+1
3145 print"You went east"
3150 gosub 5000:return
3200 rem ******************
3201 rem * check go north *
3202 rem ******************
3210 if (rd(ap(0,0), ap(0,1)) and n)=n goto 3240
3220 print"Unable to go north":return
3240 ap(0,0)=ap(0,0)-1
3245 print"You went north"
3250 gosub 5000:return
3300 rem ******************
3301 rem * check go south *
3302 rem ******************
3310 if (rd(ap(0,0), ap(0,1)) and s)=s goto 3340
3320 print"Unable to go south":return
3340 ap(0,0)=ap(0,0)+1
3345 print"You went south"
3350 gosub 5000:return
3400 rem *****************
3401 rem * "eat" command *
3402 rem *****************
3410 iq$=w2$:an=0
3415 gosub 6000:rem object in inventory?
3420 if ii=-1 then return:rem nope!
3425 o=ai(0,ii)
3430 if ot(o)<>1 then print"You can't eat that!":return
3432 print"You're eating the "+ob$(o,0)+". You feel better!"
3435 ah(0)=ah(0)+os(o):rem increase health
3440 rem if wandering bread, it move to random location
3445 if o=13 then op(o,0)=int(rnd(1)*rh):op(o,1)=int(rnd(1)*rw)
3450 gosub 5500:return:rem remove from inventory
3500 rem *******************
3501 rem * "drink" command *
3502 rem *******************
3510 iq$=w2$:an=0
3515 gosub 6000:rem object in inventory?
3520 if ii=-1 then return:rem nope!
3525 o=ai(0,ii)
3530 if ot(o)<>2 then print"That's not drinkable!":return
3533 print"You drank the "+ob$(o,0)+" and feel refreshed!"
3535 ah(0)=ah(0)+os(o):rem increase health
3540 if o<>16 then goto 3555
3545 ai(5,ic(5)-1)=o:rem return beer to landlord
3549 rem respawn baboon and return coin to inventory
3550 ai(12,0)=5:ah(12)=5
3551 ap(12,0)=int(rnd(1)*rh):ap(12,1)=int(rnd(1)*rw)
3555 gosub 5500:return:rem remove from inventory
4500 rem **********************
4501 rem * split input string *
4502 rem *     into words     *
4503 rem **********************
4505 wl=0:w$="":w2$=""
4506 for i=0 to 3:wo$(i)="":next i
4510 for i=0 to len(in$)-1
4520 rem since no break support, must finish for loop when wl>3
4530 if wl>3 goto 4690
4540 ch$=mid$(in$,i+1,1)
4550 if ch$<>" " goto 4600
4560 if w$<>"" then wo$(wl)=w$:wl=wl+1:w$=""
4570 goto 4690
4600 w$=w$+ch$
4690 next i
4695 if w$<>"" and wl<4 then wo$(wl)=w$:wl=wl+1
4697 if wl>1 then w2$=wo$(1)
4699 return
4700 rem ************************
4701 rem * is in cave, no lamp? *
4702 rem * if dark, da=1        *
4703 rem ************************
4709 da=0:rem player in cave?
4710 if not(ap(0,1)=0 and ap(0,0)>=1 and ap(0,0)<4) then return
4720 o=3:an=0:iq$="":gosub 6050:rem player has lamp?
4730 if ii<>-1 then return:rem yes!
4739 rem lamp in room?
4740 if op(3,0)=ap(0,0) and op(3,1)=ap(0,1) then return
4750 da=1:return
5000 rem ********************
5001 rem * display location *
5002 rem ********************
5004 gosub 4700
5009 if da=1 then print"It's pitch dark":return:rem no!
5010 for i=0 to 6
5020 rd$=ro$(ap(0,0),ap(0,1),i):if rd$<>"" then print rd$
5030 next i
5050 i=0
5060 gosub 5400
5070 if ii<>-1 then print "There is a sign here!"
5100 for o=0 to ol-1:rem display objects
5110 if op(o,0)=ap(0,0) and op(o,1)=ap(0,1) then print ob$(o,1)+" is here"
5120 next o
5200 for i=1 to al-1:rem display actors
5210 if ap(i,0)<>ap(0,0) or ap(i,1)<>ap(0,1) then goto 5220
5212 d$=ad$(i,1)+" is present ":pf$=""
5213 if ic(i)=0 then 5218
5214 d$=d$+"having "
5215 for t=0 to ic(i)-1:d$=d$+pf$+ob$(ai(i,t),1):pf$=" and ":next t
5218 if ac(i)<>-1 then d$=d$+pf$+"holding the "+ob$(ac(i),0)
5219 print d$
5220 next i
5399 return
5400 rem *************************
5401 rem * It there a sign here? *
5402 rem * ii=-1 if not found    *
5403 rem * else = sign index     *
5404 rem *************************
5410 i=0:ii=-1
5420 if not (sy(i)=ap(0,0) and sx(i)=ap(0,1)) then 5440
5430 ii=i:return
5440 i=i+1:if i<sl then 5420
5445 return
5450 rem *****************
5451 rem * display sign  *
5452 rem * ii=sign index *
5453 rem *****************
5460 for i=0 to 5
5470 a$=si$(ii,i):if a$<>"" then print a$
5480 next
5490 return
5500 rem *******************
5501 rem * remove object   *
5502 rem * from inventory  *
5503 rem * inv # in 'ii'   *
5504 rem * actor # in 'an' *
5505 rem *******************
5510 o=ai(an,ii)
5520 if o=ac(an) then ac(an)=-1:rem stop holding
5525 if an=0 and wr=o then wr=-1:rem stop wearing
5530 for i=ii to ic(an)-2
5540 ai(an,i)=ai(an,i+1)
5550 next i
5560 ic(an)=ic(an)-1
5570 return
6000 rem *****************************
6001 rem * check if actor has        *
6002 rem * named object              *
6003 rem * object name in 'iq$'      *
6004 rem * actor # in 'an'           *
6005 rem * ii=inv # if found else -1 *
6007 rem *****************************
6009 ii=-1
6010 if ic(an)=0 then print "You have nothing!":return
6015 for i=0 to ic(an)-1
6016 no$=ob$(ai(an,i),0)
6017 if no$=iq$ then ii=i
6020 next i
6030 if ii=-1 and an=0 then print"You don't have the "+iq$
6035 return
6050 rem **********************
6051 rem * check if actor has *
6053 rem * object # in 'o'    *
6054 rem * actor # in 'an'    *
6055 rem **********************
6057 ii=-1
6060 for i=0 to ic(an)-1
6070 if ai(an,i)=o then ii=i
6080 next i
6090 if ii=-1 and an=0 then print"You don't have the "+ob$(o,0)
6099 return:rem inventory # in var 'ii'
6100 rem ************************
6101 rem * check if a named obj *
6102 rem * is at actor's pos.   *
6103 rem * object name in 'oq$' *
6104 rem * actor # in 'an'      *
6105 rem ************************
6108 o=-1
6110 for oi=0 to ol-1
6120 if ob$(oi,0)=oq$ and op(oi,0)=ap(an,0) and op(oi,1)=ap(an,1) then o=oi
6130 next oi
6140 if o=-1 then print"There is no "+oq$+" here!"
6199 return:rem object # in var 'o'
6200 rem ***********************
6201 rem * is named actor at   *
6202 rem * player location     *
6203 rem * actor name in 'nq$' *
6204 rem ***********************
6205 an=-1
6210 for i=0 to al-1
6220 if ad$(i,0)=nq$ and ap(i,0)=ap(0,0) and ap(i,1)=ap(0,1) then an=i
6230 next i
6299 return:rem actor # in var 'an'
7000 rem *************************
7001 rem * other actor's actions *
7002 rem *************************
7010 for i=1 to al-1
7015 rem other actor in same location
7016 rem and is carrying an object?
7020 if ap(i,0)<>ap(0,0) or ap(i,1)<>ap(0,1) or ac(i)=-1 then goto 7200
7029 rem attack player
7030 if ah(0)>0 then an=i:ta=0:o=ac(an):gosub 8000
7200 next i
7499 return
8000 rem ************************
8001 rem * attack an actor      *
8002 rem * o=weapon obj #       *
8003 rem * an=attacking actor # *
8004 rem * ta=target actor #    *
8005 rem ************************
8006 p$="":da=int(rnd(1)*(os(o)+1)):rem damage
8007 if not (ta=0 and wr<>-1) then 8015
8008 ar=os(wr):a$="some"
8009 if o=8 and wr=24 then ar=ar*2:a$="extra"
8010 if o=12 and wr=23 then ar=ar*2:a$="extra"
8011 if o=2 and wr=25 then ar=ar*2:a$="extra"
8013 p$=ob$(wr,1)+" gives you "+a$+" protection against the "+ob$(o,0)
8014 da=int(da/ar)
8015 na$=ad$(an,1):hi$="attacks"
8016 tk$=ad$(an,2)+ad$(an,0):rem the killer
8017 tv$=ad$(ta,2)+ad$(ta,0):rem the victim
8020 if an=0 then hi$="attack"
8025 print:print na$+" "+hi$+" ";tv$;" with ";ob$(o,1);"!"
8033 if p$<>"" then print p$
8030 ah(ta)=ah(ta)-da
8035 if ac(ta)=-1 and ic(ta)>0 then ac(ta)=ai(ta,0)
8040 if ah(ta)<=0 then goto 8100
8050 if da=0 then print tk$;" missed ";tv$
8060 if da>0 and da<3 then print"Some damage was done to "+tv$
8070 if da>=3 then print tk$;" hurt ";tv$;" pretty hard!"
8080 if ah(ta)>10 then 8090
8085 is$="is":if ta=0 then is$="are"
8086 print ad$(ta,1);" ";is$;" badly hurt!"
8090 return
8100 print tk$; " killed ";tv$;"!!":ap(ta,0)=-1
8110 if ic(ta)=0 then return
8120 for i=0 to ic(ta)-1
8130 o=ai(ta,i):
8140 print ad$(ta,1);" dropped ";ob$(o,1)
8150 op(o,0)=ap(0,0):op(o,1)=ap(0,1)
8160 next i
8199 return
8200 rem ************************
8201 rem * sleep                *
8202 rem * i=seconds            *
8203 rem * t1=current time or 0 *
8204 rem ************************
8210 if t1=0 then gosub 8300
8215 t1=tm
8220 gosub 8300:if tm-t1<i then goto 8220
8230 t1=0:return
8300 rem *************************
8301 rem * get current time sec  *
8302 rem * time returned in 'tm' *
8303 rem *************************
8310 if len(time$)=6 then tm=val(time$):return
8320 rem special handling for fb
8330 tm$=left$(time$,2)+mid$(time$,4,2)+mid$(time$,7,2)
8340 tm=val(tm$):return
9000 rem *****************
9001 rem * get command # *
9002 rem *****************
9010 ci=0:c=-1
9019 rem goto instead of for-next loop due to no break support
9020 if not (wo$(0)=co$(ci,0) or wo$(0)=co$(ci,1)) goto 9030
9021 if co$(ci,2)<>"" and wl<2 goto 9050
9025 c=ci+1:return:rem found command!
9030 ci=ci+1
9040 if ci<cl goto 9020:rem loop back
9050 f$=wo$(0)
9055 rem if first word is a direction, set as "go" command
9060 if f$="n" or f$="north" or f$="s" or f$="south" then 9200
9070 if f$="e" or f$="east" or f$="w" or f$="west" then 9200
9100 print"I don't understand"
9110 return
9200 c=13:w2$=f$:return
10000 rem **************
10001 rem * setup game *
10002 rem **************
10010 n$=chr$(13)+chr$(10):gosub 8300:t1=tm
10020 h=0:b=0:s=1:e=2:n=4:w=8
10030 for h=0 to rh-1
10040 for b=0 to rw-1
10050 for i=0 to 6:read ro$(h,b,i):next i
10060 read rd(h,b)
10070 next b
10080 next h
12990 rem **********************
12991 rem * setting up objects *
12992 rem **********************
12994 rem object types:
12995 rem 1=food,2=drink,3=walkman,4=armor,5=rubiks cube, 6=other,
12996 rem 7=light source,8=treasure,9=readable,10=key,11=spade,12=unmovable,13=weapon
13000 for i=0 to ol-1
13010 read ob$(i,0),ob$(i,1),op(i,0),op(i,1),ot(i),os(i)
13030 if op(i,0)=-2 then op(i,0)=int(rnd(1)*rh):op(i,1)=int(rnd(1)*rw)
13040 next i
13490 rem *********************
13491 rem * setting up actors *
13492 rem *********************
13500 for i=0 to al-1
13510 rem name,long name,article,position,health,
13520 read ad$(i,0),ad$(i,1),ad$(i,2),ap(i,0),ap(i,1),ah(i)
13530 rem inventory
13540 for t=0 to il-1:read ai(i,t):next t:read ic(i),ac(i)
13550 next i
14000 rem ***********************
14001 rem * setting up commands *
14002 rem ***********************
14010 for i=0 to cl-1:read co$(i,0),co$(i,1),co$(i,2):next
15000 pr$(0)="Your command":pr$(1)="What do you want":pr$(2)="My liege"
15010 pr$(3)="Thy wish":pr$(4)="Now what"
15995 rem ***********************
15996 rem * setting up 'trades' *
15997 rem ***********************
16000 for i=0 to tl-1:read tt$(i),tr(i,0),tr(i,1),tr(i,2):next
16995 rem **********************
16996 rem * setting up 'signs' *
16997 rem **********************
17000 for i=0 to sl-1:read sy(i),sx(i)
17010 for t=0 to 5:read si$(i,t):next t
17020 next i
20000 return
29000 print "{clr}{up/lo lock on}{lower case}{gry1}";n$
29010 poke 53280,0:poke 53281,0
29015 print"H... hello? Where am I?"
29020 i=3:gosub 8200:rem sleep 3 sec
29030 return
30000 rem ****************
30001 rem * welcome text *
30002 rem ****************
30003 rem comment out the following line for freebasic
30005 print "{clr}";
30009 for i=0 to cs:poke 53280,co(i):poke 53281,co(i):for t=0 to 400:next:next
30010 poke 53280,8
30020 print"What happened? One moment you were     "
30021 print"enjoying an episode of The Cosby Show, "
30022 print"featuring that funny, totally harmless "
30023 print"Bill Cosby fella. Then, all of a sudden"
30024 print"there is a blur and a {wht}white light{gry1} and  "
30025 print"now you find yourself on some hill in  "
30026 print"unfamiliar territory. You look around. "
30100 i=3:gosub 8200:rem sleep 3 sec
32000 print:return
33000 print"{blu}Congratulations!{gry1} You found all the"
33010 print"treasures! Ragnar the witch-king appears"
33020 print"and gives you a small diamond for all"
33030 print"your troubles. 'Don't spend it all in"
33040 print"one place!' he implores.":print
33050 print"You are suddenly pulled back to your"
33060 print"home, just in time for Jessica Fletcher!"
33999 end
39000 data 11,12,15,1,15:rem flash colors
40010 data "You are standing on a hilltop, with a "
40011 data "vista over a beautiful landscape. To "
40012 data "the northwest there are tall mountains."
40013 data "Somewhere far to the south you glimpse "
40014 data "an ocean. A tall structure can be "
40015 data "spotted to the southeast. There is a"
40016 data "path to the east leading to a forest."
40019 data 2
40020 data "You are in a forest. Ancient trees"
40021 data "surround you, quite majestic actually!"
40022 data "A path continues to the south and west."
40023 data "A mighty river runs from the mountains"
40024 data "in the north towards the sea far to the"
40025 data "south, blocking passage to the east."
40029 data "",9
40030 data "You are in the valley of the dead! A  "
40031 data "The valley truly is one spooky place!"
40032 data "You feel eyes peering at you from"
40033 data "behind large boulders that look like"
40034 data "the tombstones of giants!"
40035 data "The only exit is a path to the south."
40039 data "",1
40040 data "You are inside 'The Drunken Cow'."
40041 data "This place reeks of ale and tobacco."
40042 data "But the musicians playing on the stage"
40043 data "somehow reminds you of early AC/DC!"
40044 data "Some of the tipsy customers are having"
40045 data "fun throwing food at the band."
40046 data "Exit to the south."
40049 data 1
40050 data "You are inside the store named 'Honest"
40051 data "Trader Jack's'. This place sure has a"
40052 data "lot of weird stuff!"
40053 data "You may exit the store to the south."
40059 data "","","",1
40110 data "You have entered a vast chamber, deep"
40111 data "inside the mountain."
40112 data "You may exit to the south."
40119 data "","","","",1
40120 data "You are in a forest."
40121 data "There is a river to the east. Paths"
40122 data "run north and south."
40129 data "","","","",5
40130 data "You are outside a town called Bob."
40131 data "The town gate is to the east."
40132 data "There's a river to the west."
40139 data "","","","",5
40140 data "You are on the westside of the town"
40141 data "named 'Bob'. To the north you see an"
40142 data "inn named 'The Drunken Cow'. To the"
40143 data "south you see the signmakers store."
40144 data "A road continues east and west."
40145 data "For a town, there are surprisingly few"
40146 data "buildings!"
40149 data 15
40150 data "You are on the eastside of the town."
40151 data "There's a store named 'Honest Trader"
40152 data "Jack's.' to the north. To the south you"
40153 data "see a bank named 'Bank og Zorkadia'."
40154 data "To the east there is a wall protecting"
40155 data "the town from bandits and Jehovah's"
40156 data "Witnesses."
40159 data 13
40210 data "You are inside a large, smelly cave."
40211 data "There are exit to the south, north and"
40212 data "west."
40219 data "","","","",7
40220 data "You are standing close to a cave"
40221 data "entrance to the west."
40222 data "There's a bridge crossing a river to"
40223 data "the east. A path leads north and south."
40229 data "","","",15
40230 data "You are standing outside some fortified"
40231 data "town walls to the east. You can see"
40232 data "the town gates further to the north."
40233 data "There is a bridge crossing a river to"
40234 data "the west. There is a tower in the"
40235 data "southeast direction."
40239 data "",13
40240 data "You are in the signmakers store."
40241 data "This is probably the source of all the"
40242 data "signs you've been seeing everywhere!"
40243 data "The exit is to the north."
40249 data "","","",4
40250 data "You are inside the Bank of Zorkadia."
40251 data "Unlike other locations you have"
40252 data "visited in this weird land, this place"
40253 data "seems clean and organized."
40259 data "","","",4
40310 data "You are standing in the hall of the"
40311 data "mountain king. You must be, why else"
40312 data "would that spooky Grieg-music be "
40313 data "playing in the background. The exit to"
40314 data "the north sure seems tempting now!"
40319 data "","",4
40320 data "You are standing in a cornfield. There"
40321 data "are mountains to the west. To the east"
40322 data "there is a large river. The river."
40323 data "flows towards the sea to the south."
40324 data "A small path leads south and north."
40329 data "","",5
40330 data "You are standing next to an old tower"
40331 data "to the east. A river to the west."
40332 data "There is a memorial of some kind here."
40333 data "There is a beach to the south. A narrow"
40334 data "path leads to the south and the north."
40339 data "","",7
40340 data "You are inside the tower. "
40341 data "To the east there are stairs that goes"
40342 data "up to the top."
40349 data "","","","",10
40350 data "You're at the top of the ancient tower."
40351 data "The stairs go down to the west."
40359 data "","","","","",8
40410 data "You are standing on the deck of the"
40411 data "pirate ship 'Honk If Ye're lubricious'."
40412 data "This looks just like the ship from 'The"
40413 data "Goonies'! Woops, did I spoil the movie"
40414 data "for you? Sorry!"
40415 data "You may exit the ship to the east."
40419 data "",2
40420 data "You are standing in a cove that ends in"
40421 data "the sea to the south."
40422 data "To the west a pirate vessel named 'Honk"
40423 data "If Ye're lubricious' is docked. A great"
40424 data "river to the east flows into the sea."
40429 data "","",12
40430 data "You're walking on a very sandy beach.  "
40431 data "The sea lies ahead of you to the south."
40432 data "There's a river running into the ocean"
40433 data "to the west. The beach continues to the"
40434 data "to the east."
40439 data "","",6
40440 data "You are standing on a nice beach that"
40441 data "continues to the west and east. To the"
40442 data "south a vast ocean blocks further"
40443 data "passage. A dark tower looms over you"
40444 data "to the north. You can't see any"
40445 data "entrance into the tower."
40449 data "",10
40450 data "You are on a beach that ends in a cliff"
40451 data "to the north. To the southeast the"
40452 data "ocean stretches as far as your eyes can"
40453 data "see."
40459 data "","","",8
41000 rem object data
41001 rem short name, long name, y-pos, x-pos,type,strength
41002 data "axe","a sharp axe",-1,-1,13,5
41010 data "map","a treasure map",-1,-1,9,1
41020 data "sword","a sharp pirate sword",-1,-1,13,15
41030 data "lamp","a shiny brass lamp",-1,-1,7,5
41040 data "key","a large golden key",-1,-1,10,3
41050 data "coin","a copper coin",-1,-1,6,1
41060 data "cutlass","a sharp looking cutlass",1,1,13,10
41070 data "book","a really old and dusty book",2,0,9,1
41080 data "club","a wooden club",-1,-1,13,20
41090 data "arm","a zombie arm",-1,-1,13,5
41100 data "mace","a steel mace",-1,-1,13,50
41110 data "spade","a golden spade",-1,-1,11,5
41120 data "flamethrower","a mighty flamethrower",-1,-1,13,20
41410 data "bread","a wandering bread",-2,-2,1,1
41140 data "walkman","your sony walkman",0,0,3,1
41150 data "cube","your {red}r{grn}u{blu}b{yel}i{wht}k{orng}s{gry1} cube",0,1,5,1
41160 data "beer","a refreshing beer",-1,-1,2,1
41170 data "chest","a golden chest",-1,-1,12,1
41180 data "chest","a silver chest",-1,-1,12,1
41190 data "purse","a purse full of sparkling gems",-1,-1,8,1
41200 data "sack","a sack full of flashy diamonds",-1,-1,8,1
41210 data "bag","a bag of silver coins",-1,-1,8,3
41220 data "wallet","a wallet full of golden coins",-1,-1,8,2
41230 data "tunica","a flameproof tunica",-1,-1,4,2
41240 data "breastplate","a club-proof breastplate",-1,-1,4,2
41250 data "armor","an anti-pirate armor",-1,-1,4,2
41260 data "key","a silver key",-1,-1,10,1
41270 data "brush","a long-haired pointed sable brush",-1,-1,6,1
41280 data "key","the key to the town gate",-1,-1,10,1
41290 data "gate","the town gate",1,2,12,1
41300 data "sandwich","a half eaten sandwich",0,3,1,10
41310 data "rum","a flask of the pirates' finest rum!",4,0,2,10
41320 data "cat","a black cat",1,3,1,10
41330 data "dog","a good dog",1,4,1,10
41996 rem actors data
41997 rem shortname, longname, grammatical article
41998 rem y-pos, x-pos, strength, health,
41999 rem inv1, inv2, inv3, inv4,inv-len,carry #
42000 data "you","You",""
42005 data 0,0,50,-1,-1,-1,-1,-1,0,-1
42010 data "lumberjack","A strong looking lumberjack","the "
42015 data 1,1,20,4,-1,-1,-1,-1,1,-1
42020 data "pirate","An angry pirate","the "
42025 data 4,0,20,2,1,27,-1,-1,3,2
42030 data "trader","An eager trader",""
42035 data 0,4,50,10,25,3,24,-1,4,-1
42040 data "dragon","An enormous dragon","the "
42045 data 3,4,50,12,18,-1,-1,-1,2,12
42050 data "landlord","The landlord","the "
42055 data 0,3,50,10,16,-1,-1,-1,2,-1
42060 data "zombie","A brain-eating zombie","the "
42065 data 0,2,20,9,-1,-1,-1,-1,1,9
42070 data "troll","An enormous cave troll","the "
42075 data 1,0,20,0,19,-1,-1,-1,2,0
42080 data "guard","A bored guard watching the gates","the "
42085 data 1,2,50,10,28,-1,-1,-1,2,-1
42090 data "signmaker"
42091 data "A nervous signmaker","the "
42095 data 2,3,50,10,26,-1,-1,-1,2,-1
42100 data "clerk","A pleasant looking bank clerk","the "
42105 data 2,4,50,10,11,-1,-1,-1,2,-1
42110 data "king","The mountain king","the "
42115 data 3,0,30,8,20,-1,-1,-1,2,8
42120 data "baboon","A smelly, orange baboon","the "
42125 data 2,1,5,5,-1,-1,-1,-1,1,5
43000 rem commands
43010 data "help","h",""
43020 data "look","l",""
43030 data "inventory","i",""
43040 data "dig","di",""
43050 data "quit","q",""
43060 data "take","get","<object>"
43070 data "drop","throw","<object>"
43080 data "give","gi","<object> to <someone>"
43090 data "use","u","<object>"
43100 data "open","unlock","<object>"
43110 data "read","re","<object>"
43120 data "kill","hit","<someone> with <object>"
43130 data "go","g","<direction>"
43140 data "eat","devour","<food>"
43150 data "drink","swallow","<liquid>"
43999 rem trade object data
44000 data "What interesting music! Now I'm not bored anymore!",8,14,28
44010 data "What an interesting, colorful cube!",3,15,3
44020 data "I just love books about princess saving knights!",3,7,24
44030 data "Yay! I've been looking for an arm for my collection!",3,9,25
44040 data "My axe! Now I can get to work! Thanks, little dude!",1,0,4
44050 data "To celebrate your first deposit, take this!",10,19,11
44060 data "To celebrate your new account, have this!",10,20,11
44070 data "In honor of our new business relation, take this!",10,21,11
44080 data "This is our way of showing appreciation!",10,22,11
44090 data "My brush! Thank you! I get to keep my job!",9,27,26
44100 data "One refreshing beer coming up!",5,5,16
44999 rem sign data
45000 data 0,0,"Welcome to Zorkadia, dear adventurer!"
45001 data "You have been summoned by Ragnar, the"
45002 data "witch-king who needs your help to find"
45003 data "his treasures, stolen by nasty thieves!"
45004 data "When you have banked all four treasures"
45005 data "you may return home! First class, even!"
45010 data 0,2,"Welcome to the valley of the dead!"
45011 data "I'd turn back if I were you!"
45012 data "This place ain't for the weak hearted!"
45013 data "Mohaha! Signed Ragnvald","",""
45020 data 1,1,"Welcome to Scott's Woods. Poaching,"
45021 data "illegal logging, and magic mushroom"
45022 data "picking will be reported to the"
45023 data "sheriff. Warning! Magic mushrooms are"
45024 data "{blk}literally{gry1} magical, as Joe Jackson"
45025 data "could've attested to, if he hadn't been turned into a newt!"
45030 data 1,2,"Warning! Do not go north! You will"
45031 data "enter the Valley of the Dead!"
45032 data "And that is a really, {blk}really{gry1} bad idea!","","",""
45040 data 1,4,"* Bank of Zokadia *"
45041 data "Trusted by businesses, pirates and"
45042 data "witch-kings since the year of the toad","","",""
45050 data 2,0,"Did you remember to bring a lamp?"
45051 data "Of course you did, you wouldn't be able"
45052 data "to read this sign if you didn't!,"
45053 data "Stupid, stupid, stupid! I always make"
45054 data "these mistakes. No wonder Liz got that"
45055 data "CastleMart-gig instead of me!"
45060 data 2,1,"Welcome to Will's colossal cave!"
45061 data "Beware of trolls! Lamp recommended!'"
45062 data "Get your lamps at Honest Trader Jack's!"
45063 data "Trading since the year of the fallen"
45064 data "duck!'",""
45070 data 2,2,"Welcome to the town of Bob!"
45071 data "The home of several stores with great"
45072 data "reviews on Adventure's Travel book!","","",""
45080 data 2,3,"Welcome to the signmakers store!"
45081 data "We make signs for all occasions!"
45082 data "Our lovely associate Grete will be"
45083 data "happy to sign you up for membership"
45084 data "in the customer club - for amazing"
45085 data "discounts!"
45090 data 2,4,"Deposit your treasures here for safe-"
45091 data "keeping. Aaaare you a pirate? This week"
45092 data "you get half price on safe deposit box"
45093 data "rentals! {yel}New customers get a free spade!{gry1}"
45094 data "Unearth your treasures, bring 'em here!",""
45100 data 3,2,"Here lies the remains of the"
45101 data "unfortunate knight Waldemar. He forgot"
45102 data "to put on his armor before he faced"
45103 data "{red}Flammor{gry1}, the mighty dragon."
45104 data "He won't be doing that again!",""
45110 data 4,1,"'tis the Pirates Cove. Stay away unless"
45111 data "you're a member of captain Bloodnose's"
45112 data "crew. Or you're the ale and biscuit"
45113 data "delivery guy.","",""
45120 data 4,2,"Welcome to Sandy beach!"
45121 data "Please do not litter, sing loud ballads"
45122 data "or drink excessive amounts of ale!"
45123 data "Keep your werewolf on a leash!","",""