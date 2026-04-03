# Snapchat Story Downloader Clone

This project rebuilds the Snaplytics-style Snapchat downloader flow:
- Accepts a Snapchat **username** or **full URL**.
- Attempts to fetch Snapchat public profile surfaces.
- Extracts currently exposed public media URLs (images/videos).
- Groups by likely category (`stories`, `highlights`, `spotlight`, `posts`, `other`).

## Run

```bash
npm install
npm start
```

Open `http://localhost:3000`.

## API

`GET /api/snapchat?q=<username-or-url>`

Example:

```bash
curl "http://localhost:3000/api/snapchat?q=https://www.snapchat.com/add/extraavantika"
```

## Notes

- This only works with **publicly accessible Snapchat profile content**.
- Snapchat may change payload structures at any time; extraction logic is intentionally defensive.
- No private/authenticated content is accessed.
