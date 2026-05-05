PMHub Render Hotfix

Fixes:
- Blank screen caused by JSX syntax error in Sidebar.
- Render DATA_DIR permission fallback.
- Keeps online-ready setup.

Upload these files to GitHub, commit, then redeploy Render.

If using persistent disk:
DATA_DIR=/var/data
Disk mount path=/var/data

If no disk:
Remove DATA_DIR. App will still run, but data may reset after redeploy.
