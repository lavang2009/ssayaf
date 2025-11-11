// server.js
import express from "express";
import cors from "cors";
import helmet from "helmet";
import Parser from "rss-parser";

const app = express();
const parser = new Parser();

app.use(cors());
app.use(helmet());
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.get("/rss/tuoitre", async (req, res) => {
  try {
    const rssUrl = "https://tuoitre.vn/rss/home.rss";
    const feed = await parser.parseURL(rssUrl);

    // Lấy tất cả bài hoặc tối đa 50 bài
    const maxItems = 50;
    const items = feed.items.slice(0, maxItems).map(item => ({
      title: item.title,
      link: item.link,
      pubDate: item.pubDate,
      contentSnippet: item.contentSnippet
    }));

    res.json({
      source: "Tuổi Trẻ",
      total: items.length,
      items
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Không thể lấy RSS" });
  }
});

app.get("/", (req, res) => {
  res.send("API Tuổi Trẻ RSS sẵn sàng!");
});

app.listen(PORT, () => {
  console.log(`Server đang chạy trên port ${PORT}`);
});