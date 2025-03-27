#!/usr/bin/env bash
set -euo pipefail

# Builds pgvector on postgres binaries we expect to sit at the resources directory (at build time)
if [ -f "$(git rev-parse --show-toplevel)/apps/desktop-electron/resources/postgres-16/bin/pg_config" ]; then
  PG_CONFIG_PATH="$(git rev-parse --show-toplevel)/apps/desktop-electron/resources/postgres-16/bin/pg_config"
else
  echo "Error: pg_config not found!"
  exit 1
fi

echo "Using PG_CONFIG at: $PG_CONFIG_PATH"

TMP_DIR=$(mktemp -d)
echo "Using temp directory: $TMP_DIR"

git clone --depth=1 --branch v0.8.0 https://github.com/pgvector/pgvector.git "$TMP_DIR/pgvector"
cd "$TMP_DIR/pgvector"

# Set up the required flags.
SYSROOT=$(xcrun --sdk macosx --show-sdk-path)
GETTEXT_INCLUDE=$(brew --prefix gettext)/include
GETTEXT_LIB=$(brew --prefix gettext)/lib

echo "Using sysroot: $SYSROOT"
echo "Using gettext include: $GETTEXT_INCLUDE"
echo "Using gettext lib: $GETTEXT_LIB"

make clean
make CC=clang PG_CONFIG="$PG_CONFIG_PATH" \
     CFLAGS="-isysroot $SYSROOT -I$GETTEXT_INCLUDE" \
     CPPFLAGS="-isysroot $SYSROOT -I$GETTEXT_INCLUDE" \
     LDFLAGS="-L$GETTEXT_LIB" \
     OPTFLAGS=""

make install CC=clang PG_CONFIG="$PG_CONFIG_PATH" \
     CFLAGS="-isysroot $SYSROOT -I$GETTEXT_INCLUDE" \
     CPPFLAGS="-isysroot $SYSROOT -I$GETTEXT_INCLUDE" \
     LDFLAGS="-L$GETTEXT_LIB" \
     OPTFLAGS=""

cd -
rm -rf "$TMP_DIR"
