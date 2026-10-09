@echo off
chcp 65001 >nul
rem ============================================================
rem  拼豆小程序 本地 MySQL 一键初始化（需以管理员身份运行）
rem  作用：1) 重置 root 密码为 123456
rem        2) 创建 wx_app 账号（密码 wx_app_2026）
rem        3) 创建 wx_shop 数据库并导入 schema.sql
rem  不影响本机其它数据库数据
rem ============================================================
setlocal enabledelayedexpansion
set "MYSQLBIN=C:\Program Files\MySQL\MySQL Server 8.4\bin"
set "DATADIR=C:\ProgramData\MySQL\MySQL Server 8.4\Data"
set "SCHEMA=C:\Users\21929\Desktop\wx-server\db\schema.sql"
set "MYINI=C:\ProgramData\MySQL\MySQL Server 8.4\my.ini"

echo [1/5] 停止 MySQL 服务...
net stop MySQL84
if errorlevel 1 goto :fail_stop

echo [2/5] 以跳过权限校验模式临时启动 mysqld...
start "mysql-reset-temp" /b "%MYSQLBIN%\mysqld.exe" --defaults-file="%MYINI%" --skip-grant-tables --skip-networking
echo ... 等待就绪
set "READY="
for /L %%i in (1,1,30) do (
  "%MYSQLBIN%\mysql.exe" -uroot --skip-password -e "SELECT 1" >nul 2>&1
  if not errorlevel 1 set "READY=1" & goto :ready
  timeout /t 1 /nobreak >nul
)
:ready
if not defined READY goto :fail_boot

echo [3/5] 重置 root 密码为 123456 ...
"%MYSQLBIN%\mysql.exe" -uroot --skip-password -e "FLUSH PRIVILEGES; ALTER USER 'root'@'localhost' IDENTIFIED BY '123456';"
if errorlevel 1 goto :fail_pass

echo [4/5] 停掉临时实例，恢复服务...
"%MYSQLBIN%\mysqladmin.exe" -uroot -p123456 shutdown
timeout /t 3 /nobreak >nul
net start MySQL84
if errorlevel 1 goto :fail_start

echo [5/5] 创建 wx_app 账号 / wx_shop 数据库 / 导入 schema.sql ...
"%MYSQLBIN%\mysql.exe" -uroot -p123456 -e "CREATE USER IF NOT EXISTS 'wx_app'@'%%' IDENTIFIED BY 'wx_app_2026'; CREATE USER IF NOT EXISTS 'wx_app'@'localhost' IDENTIFIED BY 'wx_app_2026'; GRANT ALL PRIVILEGES ON wx_shop.* TO 'wx_app'@'%%'; GRANT ALL PRIVILEGES ON wx_shop.* TO 'wx_app'@'localhost'; FLUSH PRIVILEGES;"
"%MYSQLBIN%\mysql.exe" -uroot -p123456 < "%SCHEMA%"
if errorlevel 1 goto :fail_schema

echo.
echo ============================================================
echo  初始化完成！
echo    root   密码: 123456
echo    wx_app 密码: wx_app_2026
echo    wx_shop 库   : schema.sql 已导入（31 张表）
echo  现在可以关闭本窗口，回对话里让我继续。
echo ============================================================
pause
exit /b 0

:fail_stop
echo [错误] 停止 MySQL 服务失败（请确认以管理员身份运行）。
pause & exit /b 1
:fail_boot
echo [错误] 临时 mysqld 未就绪。
pause & exit /b 1
:fail_pass
echo [错误] 重置 root 密码失败。
pause & exit /b 1
:fail_start
echo [错误] 重启 MySQL 服务失败。
pause & exit /b 1
:fail_schema
echo [错误] 导入 schema.sql 失败（root 密码可能已重置，可手动验证）。
pause & exit /b 1