# Business Empire v0.5

A fictional-money business tycoon with **15 businesses, 10 stocks, price history charts, bulk trading, employees, loans, real estate, and private multiplayer leaderboards**. Each player competes to reach **$1,000,000,000 net worth**.

## Solo mode (no setup)

1. Extract the ZIP.
2. Open `index.html` in a browser (or publish the complete folder on GitHub Pages).
3. Play the game. Progress autosaves in the browser.

## Enable actual multiplayer (requires your own Firebase project)

GitHub Pages can host the game files but **cannot run the multiplayer database**. The game uses a Firebase project you create to store room information and sync players' leaderboards. Firebase has usage-based limits and charges may apply above free allowances.

1. Visit https://console.firebase.google.com/ and create a project. You do not need Google Analytics for this project.
2. In **Project settings → Your apps**, register a **Web** app (`</>`), then copy the `firebaseConfig` values.
3. Open `firebase-config.js`. Replace the placeholder values for `apiKey`, `authDomain`, `projectId`, and `appId` with those from your Firebase web app config. These identifiers are intended to appear in browser code, but **do not add private service-account keys**.
4. Open **Build → Authentication → Sign-in method** in Firebase console and enable **Anonymous** authentication.
5. Open **Build → Firestore Database**, create a database, and choose your preferred database location. Open its **Rules** tab. Replace the rules with the contents of `firestore.rules` and click **Publish**. Do not use a blanket `allow read, write: if true` rule.
6. Upload **all three web files** `index.html`, `styles.css`, `game.js`, plus `firebase-config.js` to the same GitHub Pages directory. The `firestore.rules` and `README.md` files are documentation/setup files and should not be served, although accidentally uploading them is not a credential leak.
7. Open the published site with HTTPS. Click **Multiplayer → Create private room**, type a display name, and copy the invite link to friends. They can enter their name and click **Join room**.

Tips:
- You can keep your GitHub Pages site at `https://samcodes432.github.io/` or publish it inside a subfolder like `https://samcodes432.github.io/business-empire/`.
- If Firebase Authentication shows `auth/unauthorized-domain`, add your GitHub Pages host to **Authentication → Settings → Authorized domains** if Firebase allows it for your project. The browser app must be running from a supported domain.
- If permission errors appear, check that you **published** the rules from `firestore.rules` and enabled Anonymous sign-in.
- Multiplayer requires internet access. Solo runs offline if the files are already on your machine.

## How multiplayer works

- A room is identified by an 8-character invite code. Each player's room game **starts with $10,000**.
- Every player owns their own businesses, properties, loans, and investments. Progress saves in localStorage and is also synced to their Firestore player document when online.
- The leaderboard is updated via Firestore real-time listeners, typically reflecting new progress after a few seconds.
- **All players in one room see the same simulated stock market** using a deterministic seed from the room document and a 10-second clock tick. Their browser clocks should be roughly synchronized.
- Leaving a room returns to your separate solo save. Rejoining a room using the same browser and anonymous Firebase identity restores its room save. Switching browsers/devices creates a *different* anonymous identity and separate progress.
- There is **no matchmaking**, room size enforcement, chat, or real-money transactions.
- **This is a casual prototype, not cheat-proof**: game money, rankings, and room stock trading are computed client-side; players can modify their own stored data. To host competitive tournaments, move gameplay and stock transactions to a trusted server.
- Room codes are obscurity-based invitations, **not hard authorization**. Share codes only with friends. Names and game-score data from members of the room are visible to anyone who joins with the code.

## Included files

- `index.html`: all the game screens.
- `styles.css`: responsive styling.
- `game.js`: gameplay, charts, stock trading, solo storage, Firebase room logic.
- `firebase-config.js`: Firebase credentials **placeholders**, to fill out before enabling multiplayer.
- `firestore.rules`: access rules for a sample Firebase database.

## Backwards compatibility

The **solo save importer** looks for prior localStorage saves under v0.4, v0.3, v0.2, or v0.1, preserving existing businesses, properties, loans, employees, and shares in the original three stocks. The 7 new stocks start unowned. Browser localStorage is scoped to the exact web origin, so opening a file with `file://` and playing on a GitHub Pages website may yield different local saves. Keep backups of older game folders until you've confirmed progress was imported.

## Development note

This game uses the Firebase JavaScript Web SDK as browser ES modules from `www.gstatic.com/firebasejs/13.0.0`. You do not need npm. Firebase project setup and Firestore costs are owned by the person deploying the game. CDN access and anonymous auth are required for multiplayer.
