export CC65_HOME="$HOME/cc65"
export VICE_EXECUTABLE="/usr/bin/flatpak run --branch=stable --arch=x86_64 --command=x64sc net.sf.VICE"
export CC65_INC="$CC65_HOME/include"
export PATH="$PATH:$CC65_HOME/bin:$VICE_HOME"

cl65 -O -t c64 -o "$1.prg" "$1"
if [ $? -eq 0 ]; then
    $VICE_EXECUTABLE "$1.prg"
else
    echo "Compiling failed"
fi