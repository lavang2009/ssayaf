import express from "express";
import cors from "cors";
import helmet from "helmet";
import Parser from "rss-parser";

const app = express();
app.use(cors());
app.use(helmet());
app.use(express.json());

// ==============================
// CONFIG RSS SOURCES
// ==============================
const rssSources = {
  tuoitre: {
    name: "Tuổi Trẻ",
    url: "https://tuoitre.vn/rss/home.rss",
  },
  vnexpress: {
    name: "VnExpress",
    url: "https://vnexpress.net/rss/tin-moi-nhat.rss",
  },
  zing: {
    name: "Zing News",
    url: "https://zingnews.vn/rss.html",
  },
  vietnamnet: {
    name: "Vietnamnet",
    url: "https://vietnamnet.vn/rss/home.rss",
  },
};

// ==============================
// SIMPLE CACHE
// ==============================
const cache = {};
const EXPIRE = 60000; // 60 giây cache

function getCache(key) {
  const data = cache[key];
  if (!data) return null;
  if (Date.now() - data.time > EXPIRE) return null;
  return data.value;
}

function setCache(key, value) {
  cache[key] = { value, time: Date.now() };
}

// ==============================
// RSS PARSER
// ==============================
const parser = new Parser({ timeout: 7000 });

// ==============================
// Helper: Filter by hours
// ==============================
function filterByHours(items, hours) {
  if (!hours) return items;

  const limitTime = Date.now() - hours * 60 * 60 * 1000;

  return items.filter(item => {
    const time = new Date(item.pubDate).getTime();
    return !isNaN(time) && time >= limitTime;
  });
}

// ==============================
// GET ONE SOURCE
// ==============================
app.get("/rss/:source", async (req, res) => {
  const key = req.params.source.toLowerCase();
  const source = rssSources[key];

  if (!source) {
    return res.status(404).json({ error: "Nguồn RSS không tồn tại" });
  }

  const hours = req.query.hours ? Number(req.query.hours) : null;

  try {
    const cacheKey = `${key}_${hours || "all"}`;
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);

    const feed = await parser.parseURL(source.url);

    let items = feed.items.slice(0, 50).map(item => ({
      title: item.title,
      link: item.link,
      pubDate: item.pubDate,
      contentSnippet: item.contentSnippet || item.summary || null,
      source: source.name,
    }));

    items = filterByHours(items, hours);

    const response = {
      source: source.name,
      total: items.length,
      items,
    };

    setCache(cacheKey, response);
    res.json(response);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Không thể lấy RSS" });
  }
});

// ==============================
// GET ALL SOURCES COMBINED
// ==============================
app.get("/rss/all", async (req, res) => {
  const hours = req.query.hours ? Number(req.query.hours) : null;

  try {
    const cacheKey = `all_${hours || "all"}`;
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);

    let allItems = [];

    for (const [key, src] of Object.entries(rssSources)) {
      try {
        const feed = await parser.parseURL(src.url);

        const items = feed.items.slice(0, 50).map(item => ({
          title: item.title,
          link: item.link,
          pubDate: item.pubDate,
          contentSnippet: item.contentSnippet || item.summary || null,
          source: src.name,
        }));

        allItems.push(...items);

      } catch (e) {
        console.log(`Lỗi lấy RSS từ ${src.name}`);
      }
    }

    // Lọc theo thời gian
    allItems = filterByHours(allItems, hours);

    // Sắp xếp mới nhất lên đầu
    allItems.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

    const response = {
      source: "Tổng hợp",
      total: allItems.length,
      items: allItems,
    };

    setCache(cacheKey, response);
    res.json(response);

  } catch (e) {
    res.status(500).json({ error: "Không thể tổng hợp RSS" });
  }
});

// ==============================
// SEARCH IN ALL NEWS
// ==============================
app.get("/rss/search", async (req, res) => {
  const q = req.query.q?.toLowerCase();
  if (!q) return res.status(400).json({ error: "Thiếu query ?q=" });

  try {
    // Lấy RSS tổng hợp nhưng không cache để search realtime
    let allItems = [];

    for (const src of Object.values(rssSources)) {
      try {
        const feed = await parser.parseURL(src.url);
        const items = feed.items.map(item => ({
          title: item.title,
          link: item.link,
          pubDate: item.pubDate,
          contentSnippet: item.contentSnippet || item.summary || null,
          source: src.name,
        }));
        allItems.push(...items);
      } catch {}
    }

    // Search keyword title + snippet
    const filtered = allItems.filter(item =>
      item.title.toLowerCase().includes(q) ||
      (item.contentSnippet || "").toLowerCase().includes(q)
    );

    res.json({
      query: q,
      total: filtered.length,
      items: filtered,
    });

  } catch (e) {
    res.status(500).json({ error: "Không thể tìm kiếm" });
  }
});

// ==============================
// HOME
// ==============================
app.get("/", (req, res) => {
  res.send("🚀 API RSS nâng cấp đã sẵn sàng!");
});

// ==============================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server chạy tại port ${PORT}`));