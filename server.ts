import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

// Disk-persistent caching setup for API.Bible requests
const CACHE_FILE = path.join(process.cwd(), "api_bible_cache.json");

interface CacheEntry {
  data: any;
  cachedAt: number;
}

let bibleCache: Record<string, CacheEntry> = {};

try {
  if (fs.existsSync(CACHE_FILE)) {
    const content = fs.readFileSync(CACHE_FILE, "utf-8");
    bibleCache = JSON.parse(content);
    console.log(`Loaded ${Object.keys(bibleCache).length} cached API.Bible entries from disk.`);
  }
} catch (error) {
  console.warn("Could not load API.Bible cache from disk, starting empty:", error);
  bibleCache = {};
}

function saveAndCleanupCache() {
  try {
    const now = Date.now();
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    let deletedCount = 0;
    
    for (const key of Object.keys(bibleCache)) {
      if (!bibleCache[key] || typeof bibleCache[key].cachedAt !== "number" || now - bibleCache[key].cachedAt > maxAge) {
        delete bibleCache[key];
        deletedCount++;
      }
    }
    
    fs.writeFileSync(CACHE_FILE, JSON.stringify(bibleCache, null, 2), "utf-8");
    if (deletedCount > 0) {
      console.log(`Cleaned up ${deletedCount} expired cached entries.`);
    }
  } catch (error) {
    console.warn("Could not save and cleanup API.Bible cache:", error);
  }
}

let saveTimeout: NodeJS.Timeout | null = null;
function triggerSave() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveAndCleanupCache();
  }, 1000);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Books metadata cache proxy
  app.get("/api/bible/books", async (req, res) => {
    const bibleId = req.query.bibleId;
    if (!bibleId || typeof bibleId !== "string") {
      return res.status(400).json({ error: "Missing bibleId parameter" });
    }

    const apiKey = process.env.API_BIBLE_KEY || process.env.VITE_API_BIBLE_KEY;
    if (!apiKey) {
      return res.status(400).json({ error: "Missing API_BIBLE_KEY" });
    }

    const cacheKey = `books:${bibleId}`.toLowerCase();
    const now = Date.now();
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days

    if (bibleCache[cacheKey]) {
      const entry = bibleCache[cacheKey];
      if (entry && (now - entry.cachedAt) < maxAge) {
        if (entry.data && (Array.isArray(entry.data) || entry.data.data)) {
          return res.json(entry.data);
        }
      }
    }

    const baseUrl = process.env.API_BIBLE_BASE_URL || "https://api.scripture.api.bible/v1";
    const fetchUrl = `${baseUrl}/bibles/${bibleId}/books`;

    try {
      const response = await fetch(fetchUrl, {
        headers: {
          "api-key": apiKey,
          "Accept": "application/json"
        }
      });

      if (!response.ok) {
        return res.status(response.status).json({ error: `API.Bible books lookup returned ${response.status}` });
      }

      const data = await response.json();
      if (data && (Array.isArray(data) || data.data)) {
        bibleCache[cacheKey] = {
          data,
          cachedAt: Date.now()
        };
        triggerSave();
      }
      return res.json(data);
    } catch (error: any) {
      return res.status(500).json({ error: error.message || "Failed to fetch from API.Bible" });
    }
  });

  // Chapters metadata cache proxy
  app.get("/api/bible/chapters", async (req, res) => {
    const bibleId = req.query.bibleId;
    const bookId = req.query.bookId;
    if (!bibleId || typeof bibleId !== "string" || !bookId || typeof bookId !== "string") {
      return res.status(400).json({ error: "Missing bibleId or bookId parameter" });
    }

    const apiKey = process.env.API_BIBLE_KEY || process.env.VITE_API_BIBLE_KEY;
    if (!apiKey) {
      return res.status(400).json({ error: "Missing API_BIBLE_KEY" });
    }

    const cacheKey = `chapters:${bibleId}:${bookId}`.toLowerCase();
    const now = Date.now();
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days

    if (bibleCache[cacheKey]) {
      const entry = bibleCache[cacheKey];
      if (entry && (now - entry.cachedAt) < maxAge) {
        if (entry.data && (Array.isArray(entry.data) || entry.data.data)) {
          return res.json(entry.data);
        }
      }
    }

    const baseUrl = process.env.API_BIBLE_BASE_URL || "https://api.scripture.api.bible/v1";
    const fetchUrl = `${baseUrl}/bibles/${bibleId}/books/${bookId}/chapters`;

    try {
      const response = await fetch(fetchUrl, {
        headers: {
          "api-key": apiKey,
          "Accept": "application/json"
        }
      });

      if (!response.ok) {
        return res.status(response.status).json({ error: `API.Bible chapters lookup returned ${response.status}` });
      }

      const data = await response.json();
      if (data && (Array.isArray(data) || data.data)) {
        bibleCache[cacheKey] = {
          data,
          cachedAt: Date.now()
        };
        triggerSave();
      }
      return res.json(data);
    } catch (error: any) {
      return res.status(500).json({ error: error.message || "Failed to fetch from API.Bible" });
    }
  });

  // API.Bible proxy endpoint with response caching
  app.get("/api/bible/verse", async (req, res) => {
    const verseId = req.query.verseId;
    if (!verseId || typeof verseId !== "string") {
      return res.status(400).json({ error: "Missing verseId parameter" });
    }

    const apiKey = process.env.API_BIBLE_KEY || process.env.VITE_API_BIBLE_KEY;
    if (!apiKey) {
      return res.status(400).json({ error: "Missing API_BIBLE_KEY" });
    }

    const bibleId = req.query.bibleId || process.env.DEFAULT_BIBLE_ID || "7142879509583d59-01";
    
    // Check key in persistent cache
    const cacheKey = `verse:${bibleId}:${verseId}`.toLowerCase();
    const now = Date.now();
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days

    if (bibleCache[cacheKey]) {
      const entry = bibleCache[cacheKey];
      if (entry && (now - entry.cachedAt) < maxAge) {
        if (entry.data && entry.data.data) {
          const content = entry.data.data.content || "";
          const textExcerpt = content.replace(/<[^>]*>/g, "").trim();
          if (textExcerpt && 
              !textExcerpt.toLowerCase().includes("verse text coming soon") && 
              !textExcerpt.toLowerCase().includes("coming soon")) {
            return res.json(entry.data);
          }
        }
      }
    }

    const baseUrl = process.env.API_BIBLE_BASE_URL || "https://api.scripture.api.bible/v1";
    const fetchUrl = `${baseUrl}/bibles/${bibleId}/verses/${verseId}`;

    try {
      const response = await fetch(fetchUrl, {
        headers: {
          "api-key": apiKey,
          "Accept": "application/json"
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        try {
          const errorJson = JSON.parse(errorText);
          return res.status(response.status).json(errorJson);
        } catch {
          return res.status(response.status).json({ 
            error: `API.Bible returned status ${response.status}`,
            details: errorText 
          });
        }
      }

      const data = await response.json();
      
      // Perform validation checks before caching successful responses
      if (data && data.data) {
        const content = data.data.content || "";
        const cleanContent = content.replace(/<[^>]*>/g, "").trim();
        if (cleanContent && 
            !cleanContent.toLowerCase().includes("verse text coming soon") && 
            !cleanContent.toLowerCase().includes("coming soon")) {
          // Cache successful validated API response
          bibleCache[cacheKey] = {
            data: data,
            cachedAt: Date.now()
          };
          triggerSave();
        }
      }

      return res.json(data);
    } catch (error: any) {
      return res.status(500).json({ error: error.message || "Failed to fetch from API.Bible" });
    }
  });

  // Reminder Registration Endpoint
  app.post("/api/reminders/register", async (req, res) => {
    try {
      const { 
        enabled,
        type,
        time,
        timezone
      } = req.body;

      // In a real production app, you would:
      // 1. Validate the input
      // 2. Store these settings in a database (e.g. Firestore) linked to the user
      // 3. Schedule a background job (e.g. using Cloud Tasks or a CRON job) to trigger the reminder
      
      console.log("Reminder registration received:", { 
        enabled, 
        type, 
        time, 
        timezone
      });

      // For App Notifications, you'd use Web Push protocol

      res.json({ success: true, message: "Reminder settings updated on server" });
    } catch (error) {
      console.error("Reminder Registration Error:", error);
      res.status(500).json({ error: "Failed to register reminder" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
