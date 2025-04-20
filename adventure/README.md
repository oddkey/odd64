My adventure writing structured code in Commodore BASIC v2.0
=================================================

Like so many others, I started my career as a programmer by learning BASIC on a Commodore 64.
Many years later I found some old code I had written for a text adventure game. And to be honest,
I didn't understand a thing about it. The code lacked comments, there were a lot of goto calls going
here and there. And since the primitive BASIC dialect is missing modern features such as functions
and understandable variable names, it wasn't easy to understand what was going on. To be honest, the
whole thing was an embarrassment to watch!

Years later, even after taking proper programming courses in school, it took me a some time to break
the bad habits I had picked up when programming BASIC: Like continuing to use short one- or two-letter
variable names and not bothering to comment the code properly, even though issues like memory constraints
were no longer an excuse to leave out comments.

But is it unfair of me to put all the blame on the primitive programming language? Is it possible to
write BASIC 2.0 code that is readable, functional and doesn't look like cooked spaghetti?
This was the challenge I set myself: To write a text adventure in BASIC 2.0 while trying to mimic the 
structural way of writing code that I have acquired in "better" programming languages, such as Python.

The challenge is that BASIC 2.0 is missing a lot of concepts that are self-evident in today's
modern programming languages. I asked ChatGPT the following question:

What are the most important concepts missing from Commodore 64 BASIC compared to modern programming languages?

And behold, it answered:

Great question! The Commodore 64's BASIC (specifically, **Commodore BASIC v2.0**, derived from Microsoft BASIC in the
late '70s) was super stripped down compared to modern languages. Here are the most important concepts it lacks:

---

### 🔧 **1. Structured Programming Constructs**

- **Missing:** `IF...ELSE`, `WHILE`, `FOR...IN`, `SWITCH`, `DO...WHILE`
- **What it had:** Basic `IF...THEN`, `FOR...NEXT`, and `GOTO`
- **Problem:** You had to use `GOTO` and `GOSUB` for flow control, which often led to **spaghetti code**.

---

### 📦 **2. Functions and Procedures**

- **Missing:** User-defined functions or subroutines with parameters and return values.
- **What it had:** `GOSUB`/`RETURN`, but no local variables or arguments.
- **Modern use:** Functions help you write modular, reusable, and testable code.

---

### 🧠 **3. Data Structures**

- **Missing:** Arrays were the only complex type.
- **What it had:** Static one-dimensional or multidimensional arrays (`DIM A(10)`), but no lists, dictionaries, structs,
  or objects.
- **Modern use:** Modern languages have lists, maps, sets, trees, objects, classes, etc., enabling more sophisticated
  data handling.

---

### 🧪 **4. Type System**

- **Missing:** Strong typing, type inference, and custom types.
- **What it had:** Only a few built-in types (integers, floats, strings) and type inferred by variable suffixes:
    - `$` = string, `%` = integer, no suffix = float
- **Modern use:** Languages today use static or dynamic typing, type annotations, and more robust handling of types.

---

### 🧰 **5. Error Handling**

- **Missing:** `try/catch`, exceptions
- **What it had:** Crashes or printed error messages (`?SYNTAX ERROR`)
- **Modern use:** Structured error handling is essential for writing stable, fault-tolerant programs.

---

### 📦 **6. File and Memory Management**

- **Missing:** No high-level file I/O or memory management APIs
- **What it had:** BASIC had `OPEN`, `CLOSE`, `PRINT#`, `INPUT#` for basic file access, and `POKE`/`PEEK` for direct
  memory manipulation
- **Modern use:** High-level file systems, JSON parsing, memory safety, and garbage collection are all standard.

---

### 🧬 **7. Object-Oriented Programming (OOP)**

- **Missing:** No classes, inheritance, polymorphism, or encapsulation.
- **What it had:** None of it. Everything was global.
- **Modern use:** OOP helps organize code into reusable and maintainable components.

---

### 🌐 **8. Libraries and Ecosystem**

- **Missing:** No standard library beyond very primitive built-ins.
- **Modern use:** Package managers and ecosystems (like npm, pip, crates, etc.) let you leverage thousands of reusable
  modules.

---

### 🚀 **9. Concurrency and Multithreading**

- **Missing:** No concept of concurrent or parallel execution.
- **Modern use:** Threads, async/await, coroutines, and multiprocessing are vital for performance.

---

### 🧹 **10. Garbage Collection / Memory Safety**

- **Missing:** No memory management aside from `POKE` and `PEEK`.
- **Modern use:** Automatic memory management and protections prevent crashes and memory leaks.

---

### ⚙️ Honorable Mentions:

- **No debugging tools** (no breakpoints, stack traces)
- **No comments with `//` or `#`** (just `REM`)
- **No modern syntax sugar** like list comprehensions or lambdas
- **Line numbers were required** and used for control flow

---

Hey! Nice emojis!

In addition to all that, I'd like to mention the disadvantages of
not having a proper IDE when programming on a Commodore 64. How would a
modern programmer react to not being able to easily scroll/move through the
code, make searches within the code and not even be able to cut/copy/paste
text?! A mental breakdown would probably occur within short time, I imagine!

But this will not be a problem for yours truly, as I would be using a modern IDE,
like VSCode, when doing this silly challenge. Yes, it seems a bit like cheating,
but this is a hobby project that I don't want to spend an eternity on. Also, I
used the following resources:

- The VICE emulator for running the program, instead of having to transfer the code
  to a real Commodore 64, thus saving a lot of time.
- petcat, a command line tool for converting the BASIC source code into a Commodore 64
  .prg file, which will be used to run the program in the VICE emulator. This tool is
  part of the VICE installation and the following command can be used to create the
  .prg file:
- ```bash
  petcat -w2 -o adventure.prg -- src/adventure.bas
  ```
- FreeBASIC compiler, which is a command line tool that compiles the BASIC source code
  into an executable file that can be run on Windows or Linux.

Why compile the code into an executable file for the native OS? Because it saved
me a lot of time. I could start the program directly instead of having to wait
for it to be loaded in the VICE emulator. Also, it executes faster as an executable.
When running in VICE, the program is run as an interpreted program, which is quite
slow. (Using "warp" mode unfortunately causes repeating key issues.) The drawback to
writing code that can be compiled with FreeBASIC, is that the code must be written 
more formally. Memory saving tricks, like skipping spaces between commands for reducing
the code size are not allowed. And Commodore 64-only commands like "POKE" must be
commented out before compiling. Also, the following line must be on the first line
of code in order for the compiler to allow old-style BASIC syntax, like line-numbers:

```basic
#LANG "qb"
```
Currently, this line is commented out using a semicolon: `;#LANG "qb"`.
As soon as these conditions are present, the code can be compiled using the command
line:

```bash
fbc src/adventure.bas
```
# The challenge: writing a "structural" BASIC adventure
## GOSUB - RETURN as substitution for functions
The challenge I set out to solve was to write a text adventure in BASIC 2.0, but try
to write it in a "structural" and "functional" way. This was challenging due to the
reasons mentioned above: No "functions" support. No proper IF...ELSE support. No support 
for "while" type loops. And requiring line number based GOTOs for control flow. Also, all 
variables are global, which may lead to overwriting of variables by mistake. And 
limiting to two characters for variable names makes it hard to write readable code.  

Side note: BASIC 2.0 actually has support for "functions", but these are limited to writing
calculation functions, like:
```basic
10 def fn fa(x) = x + 1
20 print fn fa(5)
```
Not very helpful when the function you need is e.g. checking what items are present in
a specific location in an adventure game. I made an attempt to create a "fn" function for
calculating damage in a fight. But the FreeBASIC compiler did not support this feature, so 
I let it go.

Instead of proper functions, I needed to use the "GOSUB" and "RETURN" commands to emulate
functions. The "GOSUB" command jumps to a specific line in the program and the "RETURN"
command jumps back to the line where the "GOSUB" command was called. For example:
```basic
10 if co$="quit" then gosub 1500
...
1500 rem ******************
1501 rem * "quit" command *
1502 rem ******************
1510 input "Quit? Are you sure (y/n)";a$
1520 if a$<>"y" then return
1530 print"Goodbye!":end
```
As you can guess, this "function" is used for the "quit" command to confirm that the
player really wants to quit the game. 

But GOSUB - RETURN "functions" do not allow parameters and return values. Instead, we need to
use global variables. In order to make some kind of contract between the caller and the
"function", we need to comment the code, explaining the expected "parameters" and "return values",
in the form of global variables that shall be used.

E.g. when the "drop" command is called, we need to check if the object is present in the
inventory:
```basic
1900 rem ******************
1901 rem * "drop" command *
1902 rem ******************
1904 rem object in inventory?
1905 iq$=wo$(1):an=0:gosub 6000
1910 if ii=-1 then return:rem nope!
...
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
```
Two global variables must be set, the object name in 'iq$' and the actor # in 'an'.
If the object is present in the inventory, the "ii" variable is set to the inventory,
else "ii" is set to -1.

Notice how the for-loop isn't stopped once the object is found. Instead, the loop
continues to the end. This is because BASIC 2.0 does not support the "break" keyword,
used in other languages to make a clean exit from a loop.
Leaving for-loops before finishing will eventually lead to "out of memory" errors due
to new loops being added onto the stack. Only when the loop is finished, the loop
will be removed from the stack.

For a BASIC dialect that supports functions, the "inventory" function may
look like this: 
```basic
function dropObject(objectName) as integer
  ii=checkObjectInInventory(0,objectName)
  if ii=-1 then return -1
  ...
end function
...
function checkObjectInInventory(actorNo, objectName) as integer
  if actorIventoryCount(actorNo) = 0 then 
    print "You have nothing!"
    return -1
  end if
  res = -1
  for i=0 to actorIventoryCount(actorNo)-1
    checkObjectName = objectNames(actorInventory(actorNo,i))
    if checkObjectName = objectName then
      res = i 
      break 
  next i
  if res = -1 then print "You don't have the " + objectName
  return res
end function
```
A class based implementation may look like this in Python:
```python
class Actor:
  inventory: List[GameObject] = []

  def dropObject(self, objectName):
    inventoryNo = self.checkObjectInInventory(objectName)
    if inventoryNo == -1:
      return
    print(f"Dropping the {objectName}")
    # ...

  def checkObjectInInventory(self, objectName) -> int:
    i = -1
    if len(self.inventory) == 0:
      print("You have nothing!")
      return i
    for inv in self.inventory:
      i += 1
      if inv.name == objectName:
        return i
    print(f"You don't have the {objectName}!")
    return -1
```
The function and class based implementation would be much more readable and maintainable,
and comments would be less necessary due to the use of human-readable function and class names.

## Arrays as substitutes for structured data types
Since BASIC 2.0 lacks support for structured data types, I had to use arrays to represent
complex data structures. Two such data structures would be the game objects and the game characters, or "actors".

A game object in the game has a short name, a long name, a location, a weapon strength and a type.

E.g. one of the objects is a cutlass. 
- It has a short name of "cutlass"
- The cutlass has a long name of "A sharp looking cutlass"
- The cutlass is located with the coordinates (1,1). 
- The cutlass has a strength of 10.
- The cutlass is an object of type "weapon" (13)

An "actor" in the game has a short name, a long name, a grammatical article, a location, a 
health score and an object inventory. The actor may also be holding one of the objects in the inventory. 

E.g. one of the actors is a pirate. 
- It has a short name of "pirate"
- The pirate has a long name of "An angry pirate"
- The pirate has the grammatical article "the" (the pirate)
- The pirate is located with the coordinates (4,0). 
- The pirate has a health score of 20.
- The pirate has the following items in its inventory:
  - A pirate sword
  - A treasure map
  - A brush
- The pirate is holding the pirate sword


A class based implementation of a game object would look like this in Python:
```python
class GameObject:
  def __init__(self, name, long_name, x, y, strength, type):
    self.name = name
    self.long_name = long_name
    self.x = x
    self.y = y
    self.strength = strength
    self.type = type
```
When initializing the cutlass, the following code would be used:
```python
objects = []
cutlass = GameObject("cutlass", "A sharp looking cutlass", 1, 1, 10, 13)
objects.append(cutlass)
```

A class based implementation of an actor would look like this in Python:
```python
class InventoryItem:

class Actor:
  def __init__(self, name, long_name, article, x, y, health, inventory, holding):
    self.name = name
    self.long_name = long_name
    self.article = article
    self.x = x
    self.y = y
    self.health = health
    self.inventory = inventory
    self.holding = holding
```
When initializing the pirate actor, the following code would be used:
```python
actors = []
pirate = Actor("pirate", "An angry pirate", "the", 4, 0, 20, [pirate_sword, treasure_map, brush], pirate_sword)
actors.append(pirate)
```
But since we don't have support for these kind of structures in BASIC 2.0, the same data is represented using arrays.

For game objects, I used the following arrays:

```basic
34 rem * objects *
35 ol=34:rem no. of objects
36 rem description, positions
37 dim ob$(ol,2):dim op(ol,2)
38 rem object type, weapon strength
39 dim ot(ol):dim os(ol)
```
Objects are defined as DATA statements and read into memory using READ statements:

```basic
12990 rem **********************
12991 rem * setting up objects *
12992 rem **********************
12994 rem object types:
12995 rem 1=food,2=drink,3=walkman,4=armor,5=rubiks cube, 6=other,
12996 rem 7=light source,8=treasure,9=readable,10=key,11=spade,12=unmovable,13=weapon
13000 for i=0 to ol-1
13010 read ob$(i,0):read ob$(i,1)
13020 read op(i,0):read op(i,1):read ot(i):read os(i)
13030 if op(i,0)=-2 then op(i,0)=int(rnd(1)*rh):op(i,1)=int(rnd(1)*rw)
13040 next i
```
The definition of the cutlass object is defined with the following DATA statement:

```basic
13050 data "cutlass","A sharp looking cutlass",1,1,10,13
```

Actors are defined using the following arrays:

```basic
42 il=5:rem max inventory length
43 rem * actors, 0 is player *
45 an=-1:al=12:wr=-1
46 rem description, positions, health
47 dim ad$(al,3):dim ap(al,2):dim ah(al)
50 rem inventory, inv. count, carrying
51 dim ai(al,il):dim ic(al):dim ac(al)
```

Actors are defined as DATA statements and read into memory using READ statements:

```basic
13490 rem *********************
13491 rem * setting up actors *
13492 rem *********************
13500 for i=0 to al-1
13510 read ad$(i,0):read ad$(i,1):read ad$(i,2):rem name
13520 read ap(i,0):read ap(i,1):read ah(i):rem position, health
13530 rem inventory
13540 for t=0 to il-1:read ai(i,t):next t:read ic(i):read ac(i)
13550 next i
```
The definition of the pirate actor is defined with the following DATA statements:

```basic
42020 data "pirate","An angry pirate","the "
42025 data 4,0,20,2,1,27,-1,-1,3,2
```
Since the size of BASIC 2.0 arrays cannot be dynamic, I have to use fixed size arrays. And this means the inventory
length must be defined as a variable instead of being read using array length. That is what the "ic" array is for,
"inventory count". The inventory array, "ai", is a two-dimensional array in which the first dimension is the
actor number and the second dimension is the inventory slot number.

Lacking support for "constants" in BASIC 2.0, the objects and actors must be identified using index numbers. E.g.
the pirate has index number 2 and the cutlass has index number 6. In order to keep tabs on this, I needed to
create tables for the objects and actors:

Objects:

| Index | Name    | Type           | Position |
|-------|---------|----------------|----------|
| 0     | axe     | 13:weapon      | (-1,-1)  |
| 1     | map     | 9:readable     | (-1,-1)  |
| 2     | sword   | 13:weapon      | (-1,-1)  |
| 3     | lamp    | 7:light source | (-1,-1)  |
| 4     | key     | 4:key          | (-1,-1)  |
| 5     | coin    | 6:other        | (-1,-1)  |
| 6     | cutlass | 13:weapon      | (1,1)    |

Actors:

| Index | Name        | Position  |
|-------|-------------|-----------|
| 0     | player      | (0,0)     |
| 1     | lumberjack  | (1,1)     |
| 2     | pirate      | (4,0)     |

The full tables can be found in the [tables.md](tables.md) file.

## Game flow control
The game main loop is based on using a GOTO statement, since there is no
"do...while" support in BASIC 2.0. The main loop logic is pretty simple:

1. Print a random prompt and get the input
2. Parse the input and split into words
3. Process the first word and return a command number
4. Execute the command handler
5. Execute actions for other actors in the same location
6. Go back to step 1, or exit if the game is over

In order to jump to the right command handler, the on...gosub statement is used. It works simply
by using the command number as an index to the on...gosub statement. This can be compared to
the switch...case statement in C. Except that the switch...case statement allows for using
constants and function calls, which makes it possible for someone who reads the code to actually
understand what is going on.

Anyway, the main loop looks like this:

```basic
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
```

## In conclusion
This little project set out to confirm whether or not it is possible to write structured 
programs in BASIC 2.0. And I think I can conclude that it is possible - to a certain degree!
As long as you make sure to use the GOSUB statement as a replacement for functions and
document the "functions" using thorough comments, the code will be readable and maintainable.
The lack of typed structures and long variable names are huge obstacles, both when it comes
to maintaining and refactoring the code. But for minor projects like this, it is not a big deal.

Anyway, I had a lot of fun writing this tiny text adventure. Hopefully other retro computer enthusiasts
will find it interesting as well. Thank you for reading!

 - Kenneth Oden, 2025