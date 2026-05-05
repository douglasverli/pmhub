PMHub Online Ready

What this version is for:
This package is ready to deploy online so people can access your PMHub using a real URL.

Hosting target:
Render web service with a persistent disk.

Files included:
index.html
server.js
package.json
package-lock.json
pmhub-data.json
render.yaml

How data saves online:
The server uses DATA_DIR when available.
On Render, DATA_DIR is set to /var/data.
Your database file will be:
/var/data/pmhub-data.json

How data saves locally:
If DATA_DIR is not set, it saves beside server.js as:
pmhub-data.json

Render setup:
1. Create a GitHub repo.
2. Upload these files.
3. In Render, create a new Web Service from that repo.
4. Use:
   Build Command: npm install
   Start Command: npm start
5. Add environment variable:
   DATA_DIR = /var/data
6. Add a persistent disk:
   Mount Path: /var/data
7. Deploy.

Default login:
admin@pmhub.com
admin123

Account creation:
Users can create their own account from the login screen.

Project invite endpoint:
POST /api/projects/:id/invite

Example body:
{
  "email": "teammate@example.com",
  "name": "Team Member",
  "role": "Editor"
}

Health check:
GET /api/health

Important:
This is online-ready with JSON persistent storage. For a heavier production product, the next upgrade should move the database to PostgreSQL or MongoDB and add Socket.IO for real-time collaboration.
