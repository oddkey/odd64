My adventure writing structured code in Commodore BASIC v2.0
=================================================

Like so many others, I started my career as a programmer by learning BASIC on a Commodore 64.
Many years later I found some old code I had written for a text adventure game. And to be honest,
I didn't understand a thing about it. The code lacked comments, there were a lot of goto calls going
here and there. And since the primitive BASIC dialect lacked the ability to create named functions
and understandable variable names, it wasn't easy to understand what was going on. To be honest, the
whole thing was quite embarrassing to watch!

Years later, even after taking proper programming courses in school, it took me a some time to break
the bad habits I had picked up when programming BASIC: Like continuing to use short one- or two-letter
variable names, not bothering to comment the code properly.

But is it unfair of me to put all the blame on the primitive programming language? Is it possible to
write BASIC 2.0 code that is readable, functional, and doesn't look like cooked spaghetti?
This was the challenge I set myself: To write a text adventure in BASIC 2.0 in the structural
way of writing code that I have acquired in "better" programming languages, such as Python.

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
slow. Using "warp" mode unfortunately caused repeating key issues. The drawback is
that the code must be written more formally, "tricks" like skipping spaces for reducing
the code size are not allowed, and Commodore 64-only commands like "POKE" must be
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
The challenge I set out to solve was to write a text adventure in BASIC 2.0, but try
to write it in a "structural" and "functional" way. This was challenging due to the
reasons mentioned above: No "functions" support, no proper IF...ELSE, no proper loops,
and requiring line numbers for control flow. Also, all variables are global, which may
lead to overwriting of variables by mistake, and the code is not very readable. 

BASIC 2.0 actually has support for "functions", but these are limited to writing
calculation functions, like:
```basic
10 def fn fa(x) = x + 1
20 print fn fa(5)
```
Not very helpful when the function you need is e.g. checking what items are present in
a specific location in an adventure game. And when I tried creating a "fn" function for
calculating damage in a fight, the FreeBASIC compiler did not support this feature so 
I let it go.

Instead of proper functions, I needed to use the "GOSUB" and "RETURN" commands to emulate
functions. The "GOSUB" command jumps to a specific line in the program and the "RETURN"
command jumps back to the line where the "GOSUB" command was called. For example:
```basic
if co$="quit" then gosub 1500
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

But GOSUB - RETURN "functions" do not allow parameters in and return values. We need to
use global variables. In order to make some kind of "contract" between the caller and the
"function", we need to comment the code with the expected global parameters and return values.
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
  for i=0 to actorIventoryCount(actorNo)-1
    checkObjectName = objectNames(actorInventory(actorNo,i))
    if checkObjectName = objectName then return i
  next i
  print "You don't have the " + objectName
  return -1
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
and comments would be less necessary due to the use of human readable function and class names.

