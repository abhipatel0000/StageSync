@echo off
echo Adding Railway backend to Windows hosts file...
echo 69.46.46.20 stagesync-production-04d1.up.railway.app >> C:\Windows\System32\drivers\etc\hosts
echo Done! DNS updated.
ipconfig /flushdns
echo Browser DNS cache cleared.
pause
