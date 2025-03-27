@echo off
REM build-pgvector-windows.bat
SETLOCAL ENABLEDELAYEDEXPANSION
echo Setting up pgvector build for Windows...
REM Parse command line arguments
SET TARGET_PG_DIR=%~1
IF "%TARGET_PG_DIR%"=="" (
    echo Usage: %0 POSTGRES_DIRECTORY
    echo Example: %0 C:\Users\username\Desktop\postgres-16-windows
    exit /b 1
)
echo Using PostgreSQL at: %TARGET_PG_DIR%

REM Check for environment variable override
IF NOT "%VS_PATH%"=="" (
    SET "VCVARS_PATH=%VS_PATH%"
    echo Using VS_PATH from environment: %VCVARS_PATH%
    goto VS_FOUND
)

REM Find Visual Studio installation
SET "VCVARS_PATH="
IF EXIST "C:\Program Files\Microsoft Visual Studio\2022\Enterprise\VC\Auxiliary\Build\vcvars64.bat" (
    SET "VCVARS_PATH=C:\Program Files\Microsoft Visual Studio\2022\Enterprise\VC\Auxiliary\Build\vcvars64.bat"
) ELSE IF EXIST "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat" (
    SET "VCVARS_PATH=C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat"
) ELSE IF EXIST "C:\Program Files\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat" (
    SET "VCVARS_PATH=C:\Program Files\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
) ELSE IF EXIST "C:\Program Files (x86)\Microsoft Visual Studio\2019\Community\VC\Auxiliary\Build\vcvars64.bat" (
    SET "VCVARS_PATH=C:\Program Files (x86)\Microsoft Visual Studio\2019\Community\VC\Auxiliary\Build\vcvars64.bat"
) ELSE IF EXIST "C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools\VC\Auxiliary\Build\vcvars64.bat" (
    SET "VCVARS_PATH=C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
)

IF "%VCVARS_PATH%"=="" (
    echo Could not find Visual Studio vcvars64.bat. Please install Visual Studio with C++ support.
    exit /b 1
)

:VS_FOUND
echo Found Visual Studio at: %VCVARS_PATH%

REM Create temporary build folder
SET "BUILD_DIR=%TEMP%\pgvector_build"
IF EXIST "%BUILD_DIR%" rmdir /s /q "%BUILD_DIR%"
mkdir "%BUILD_DIR%"
cd /d "%BUILD_DIR%"

REM Clone pgvector repository
echo Cloning pgvector repository...
git clone --branch v0.8.0 --depth 1 https://github.com/pgvector/pgvector.git
cd pgvector

REM Create a temporary batch file to run with Visual Studio environment
echo @echo off > build_with_vs.bat
echo call "%VCVARS_PATH%" >> build_with_vs.bat
echo set "PGROOT=%TARGET_PG_DIR%" >> build_with_vs.bat
echo echo Building pgvector... >> build_with_vs.bat
echo nmake /F Makefile.win >> build_with_vs.bat
echo IF !ERRORLEVEL! NEQ 0 exit /b !ERRORLEVEL! >> build_with_vs.bat
echo echo Installing pgvector to bundled PostgreSQL... >> build_with_vs.bat
echo nmake /F Makefile.win install >> build_with_vs.bat
echo IF !ERRORLEVEL! NEQ 0 exit /b !ERRORLEVEL! >> build_with_vs.bat

REM Execute the temporary batch file
call build_with_vs.bat
IF %ERRORLEVEL% NEQ 0 (
    echo Error building pgvector
    exit /b %ERRORLEVEL%
)

echo pgvector build for Windows completed successfully!
echo Check the following directories for the installed extension:
echo %TARGET_PG_DIR%\lib
echo %TARGET_PG_DIR%\share\extension
exit /b 0
