@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 開発サーバーを起動します。準備ができたらブラウザが開きます。
echo 終了するときはこの窓で Ctrl+C を押してください。
call npm run dev
pause
