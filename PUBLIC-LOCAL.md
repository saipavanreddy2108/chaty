# Make Chaty Public Without a Database

This setup stores accounts and messages in your private Google Sheet through Apps Script. Your computer must stay powered on and Chaty must stay running while people use the public link.

## Start Chaty

Open a terminal in this folder and run:

```bash
npm run build
npm run dev
```

Leave that terminal open. It runs Chaty using Google Sheets storage.

## Create a public link

Open a second terminal in this folder and run:

```bash
npm run public
```

LocalTunnel prints an `https://...` URL. Share that URL with other people. They can open it from anywhere, and messages will use your Google Sheet through your running Chaty server.

## Important limitations

- This is suitable for testing and a small private group, not a production social network.
- Anyone with the link can connect while your computer is online.
- Only expose Chaty's port `3001` through the tunnel.
- Keep the Google Sheet private and never put its edit URL in the client.
- Users sign in with the username and password saved in the `Users` tab.
- Add a `Requests` tab with headers: `requestId | from | to | messageId | status | createdAt`.