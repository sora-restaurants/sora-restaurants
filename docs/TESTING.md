# Test Sora in 5 minutes

Everything runs on your own computer with made-up test data. Nothing goes online.

## First time only

1. Install **Node.js 22 or newer** (the LTS download from nodejs.org).
2. Get the code (Troy: clone the private GitHub repo; Juan: you already have it).
3. In a terminal, in the Sora folder:

```bash
corepack enable
pnpm install
```

## Every time

**Windows:** double-click `start-demo.bat` in the Sora folder.
**Mac (or Windows terminal):**

```bash
pnpm demo
```

Wait for "Sora demo is running", then open **http://localhost:3000/demo**.

That page has everything: a QR code to scan with your phone, a button for the kitchen board, the test logins,
and a list of things to try. Keep the terminal open while testing; close it (or Ctrl-C) to stop.

The first time a Mac or Windows asks whether to allow incoming connections for Node, allow it on private
networks so your phone can connect. Your phone must be on the same Wi-Fi as the computer.

Fresh test data: stop the demo, then `pnpm demo --reset`.

## Report what you find

For each problem: what you did, what you expected, what happened, and a screenshot. Phone model and browser
help for anything on the menu.
