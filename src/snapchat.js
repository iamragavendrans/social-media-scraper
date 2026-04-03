const SNAPCHAT_USERNAME_REGEX = /^[a-zA-Z0-9._-]{3,30}$/;

const DEFAULT_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  accept: "text/html,application/json;q=0.9,*/*;q=0.8",
};

export function normalizeInput(input) {
  if (!input || typeof input !== "string") {
    throw new Error("Please provide a Snapchat username or URL.");
  }

  const raw = input.trim();
  if (!raw) {
    throw new Error("Please provide a Snapchat username or URL.");
  }

  if (SNAPCHAT_USERNAME_REGEX.test(raw)) {
    return raw;
  }

  let url;
  try {
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    url = new URL(withProtocol);
  } catch {
    throw new Error("Input is neither a valid username nor a supported URL.");
  }

  const host = url.hostname.replace(/^www\./i, "").toLowerCase();
  const parts = url.pathname.split("/").filter(Boolean);

  if (["snapchat.com", "t.snapchat.com", "share.snapchat.com", "story.snapchat.com"].includes(host)) {
    if (parts[0] === "add" && parts[1]) return parts[1];
    if (parts[0]?.startsWith("@")) return parts[0].slice(1);
    if (parts[0] && SNAPCHAT_USERNAME_REGEX.test(parts[0])) return parts[0];
  }

  throw new Error("Unsupported Snapchat URL. Use a public profile URL or username.");
}

function tryParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractJsonBlocks(html) {
  const blocks = [];

  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let scriptMatch;
  while ((scriptMatch = scriptRegex.exec(html)) !== null) {
    const scriptText = scriptMatch[1]?.trim();
    if (!scriptText) continue;

    if (scriptText.startsWith("{") || scriptText.startsWith("[")) {
      const parsed = tryParseJson(scriptText);
      if (parsed) blocks.push(parsed);
    }

    const assignmentRegex = /(?:window\.|self\.|globalThis\.)?[A-Za-z0-9_$]+\s*=\s*(\{[\s\S]*\}|\[[\s\S]*\]);?/g;
    let assignment;
    while ((assignment = assignmentRegex.exec(scriptText)) !== null) {
      const parsed = tryParseJson(assignment[1]);
      if (parsed) blocks.push(parsed);
    }
  }

  const nextDataRegex = /<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i;
  const nextDataMatch = html.match(nextDataRegex);
  if (nextDataMatch?.[1]) {
    const parsed = tryParseJson(nextDataMatch[1]);
    if (parsed) blocks.push(parsed);
  }

  return blocks;
}

function classifyFromPath(path) {
  const lower = path.toLowerCase();
  if (lower.includes("story")) return "stories";
  if (lower.includes("highlight")) return "highlights";
  if (lower.includes("spotlight")) return "spotlight";
  if (lower.includes("post") || lower.includes("tile")) return "posts";
  return "other";
}

function collectMediaFromJson(node, path = "", bucket = []) {
  if (node == null) return bucket;

  if (typeof node === "string") {
    if (/^https?:\/\//i.test(node) && /\.(mp4|mov|jpg|jpeg|png|webp)(\?|$)/i.test(node)) {
      bucket.push({
        mediaUrl: node,
        mediaType: /\.(mp4|mov)(\?|$)/i.test(node) ? "video" : "image",
        category: classifyFromPath(path),
        sourcePath: path,
      });
    }
    return bucket;
  }

  if (Array.isArray(node)) {
    node.forEach((child, i) => collectMediaFromJson(child, `${path}[${i}]`, bucket));
    return bucket;
  }

  if (typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      collectMediaFromJson(value, path ? `${path}.${key}` : key, bucket);
    }
  }

  return bucket;
}

function dedupeMedia(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (seen.has(item.mediaUrl)) return false;
    seen.add(item.mediaUrl);
    return true;
  });
}

async function fetchHtml(url) {
  const response = await fetch(url, { headers: DEFAULT_HEADERS, redirect: "follow" });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url} (${response.status}).`);
  }

  return response.text();
}

export async function fetchSnapchatContent(input) {
  const username = normalizeInput(input);

  const candidatePages = [
    `https://www.snapchat.com/add/${username}`,
    `https://story.snapchat.com/@${username}`,
    `https://www.snapchat.com/spotlight/${username}`,
  ];

  const htmlPages = [];
  const errors = [];

  for (const page of candidatePages) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const html = await fetchHtml(page);
      htmlPages.push({ page, html });
    } catch (error) {
      errors.push({ page, error: error.message });
    }
  }

  if (!htmlPages.length) {
    throw new Error(`Could not fetch Snapchat public pages for '${username}'.`);
  }

  const allMedia = [];
  for (const { page, html } of htmlPages) {
    const jsonBlocks = extractJsonBlocks(html);
    for (const block of jsonBlocks) {
      allMedia.push(...collectMediaFromJson(block, page));
    }
  }

  const media = dedupeMedia(allMedia);

  const grouped = {
    stories: media.filter((item) => item.category === "stories"),
    highlights: media.filter((item) => item.category === "highlights"),
    spotlight: media.filter((item) => item.category === "spotlight"),
    posts: media.filter((item) => item.category === "posts"),
    other: media.filter((item) => item.category === "other"),
  };

  return {
    username,
    fetchedAt: new Date().toISOString(),
    sourcePages: htmlPages.map((p) => p.page),
    warnings: errors,
    totals: {
      all: media.length,
      stories: grouped.stories.length,
      highlights: grouped.highlights.length,
      spotlight: grouped.spotlight.length,
      posts: grouped.posts.length,
      other: grouped.other.length,
    },
    media,
    grouped,
  };
}
