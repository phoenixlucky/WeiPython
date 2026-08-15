@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

REM ============================================================
REM  WeiPython Manager 一键打包工具
REM  功能：显示当前版本号 / 设置新版本号 / 一键打包
REM ============================================================

cd /d "%~dp0"
title WeiPython Manager 一键打包

echo ============================================================
echo    WeiPython Manager 一键打包工具
echo ============================================================
echo.

REM ---------- 读取当前版本号 ----------
for /f "delims=" %%i in ('node scripts\set-version.mjs') do set "CUR_VERSION=%%i"
if errorlevel 1 (
  echo [错误] 读取版本号失败。
  echo        请确认已安装 Node.js，并且本脚本位于项目根目录。
  pause
  exit /b 1
)
echo 当前版本号：v%CUR_VERSION%
echo.

REM ---------- 设置新版本号（可选） ----------
set "NEW_VERSION="
set /p "NEW_VERSION=请输入新版本号（直接回车保持 v%CUR_VERSION%）："
if not "!NEW_VERSION!"=="" (
  node scripts\set-version.mjs --check !NEW_VERSION! >nul 2>&1
  if errorlevel 1 (
    echo [错误] 版本号格式不正确：!NEW_VERSION!
    echo        应为 X.Y.Z，例如 2.8.0；可选预发布后缀，例如 2.8.0-beta.1
    pause
    exit /b 1
  )
  echo 正在更新版本号 ...
  node scripts\set-version.mjs !NEW_VERSION!
  set "CUR_VERSION=!NEW_VERSION!"
  echo.
)

REM ---------- 选择打包模式 ----------
echo 打包模式：
echo   1 - 完整安装包（NSIS，生成 Setup.exe，推荐）
echo   2 - 免安装目录（win-unpacked，不生成安装程序，更快）
set "MODE="
set /p "MODE=请选择（直接回车默认 1）："
if "!MODE!"=="2" (
  set "PACK_CMD=npm run pack"
) else (
  set "PACK_CMD=npm run dist"
)

REM ---------- 依赖检查 ----------
if not exist node_modules\electron-builder (
  echo [提示] 未检测到 electron-builder，先执行 npm install ...
  call npm install
  if errorlevel 1 (
    echo [错误] npm install 失败。
    pause
    exit /b 1
  )
)

echo.
echo ============================================================
echo  开始打包 v!CUR_VERSION! ...
echo  命令：!PACK_CMD!
echo  开始时间：%date% %time%
echo ============================================================
call !PACK_CMD!
set "BUILD_CODE=%errorlevel%"
echo ============================================================
if not "!BUILD_CODE!"=="0" (
  echo [错误] 打包失败，错误码 !BUILD_CODE!，请查看上方日志。
  pause
  exit /b 1
)

echo.
echo [成功] 打包完成！
echo 产物目录：dist
for /f "delims=" %%f in ('dir /b /o-d dist\*.exe 2^>nul') do (
  echo 安装包：dist\%%f
  goto :show_done
)
:show_done
echo 结束时间：%date% %time%
echo.
pause
