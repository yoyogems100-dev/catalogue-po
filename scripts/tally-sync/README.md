# Tally live sync

Keeps **Admin → Tally accounts** (`/admin/tally`) up to date with TallyPrime.

The website can't reach Tally because Tally sits on the office network, so this small program does the reaching. It runs on a computer that can see Tally. Every minute it asks Tally whether anything has changed, which takes about 20 ms. When something has changed, or when **Sync now** is tapped on the website, it reads the books and sends them up.

- **Read only.** It only sends *Export* requests to Tally and refuses to send anything else. It can't change your books.
- **Safe on Tally.** It never asks Tally to calculate closing stock, because that calculation can freeze Tally for minutes. Stock in hand is worked out on the website from opening stock plus every entry.
- **Private.** The data goes only to the private storage behind the Tally password. A sync key proves the program is yours. Making a new key in the portal cuts off the old one.

Needs [Node.js](https://nodejs.org) 18 or newer. Nothing else to install.

## Set up

1. On the website, go to **Tally accounts → Sync settings → Make a sync key** and copy the key.
2. On the sync computer, open a terminal in this folder and run:

   ```
   node tally-sync.mjs setup
   ```

   Paste the key when asked. For the Tally address, enter:
   - `http://127.0.0.1:9000` if this computer is the Tally PC
   - `http://<the Tally PC's Tailscale address>:9000` when this is another computer on your Tailscale network

3. Test it:

   ```
   node tally-sync.mjs check
   node tally-sync.mjs once
   ```

4. Keep it running in the background, starting automatically at login:
   - **Windows (the Tally PC):** `install-windows.cmd`
   - **Mac:** `bash install-mac.sh`

To stop it, run `install-windows.cmd remove` or `bash install-mac.sh remove`. Problems are written to `sync.log` in `yoyo-tally-sync` in your home folder.

## Best place to run it

Run it on **the Tally PC itself**. It's on whenever Tally is, and it reads Tally locally. A laptop only syncs while it's awake and connected to Tailscale.

TallyPrime must be open with the company loaded, with its XML server on port 9000 (**F1 → Settings → Connectivity → Client/Server configuration**).
