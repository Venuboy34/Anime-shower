import axios from "axios";
import * as cheerio from "cheerio";

export default async function handler(req, res) {
  const { query } = req.query;

  if (!query) {
    return res.status(400).json({ status: "error", message: "query is required, example: ?query=naruto /episode 2" });
  }

  const [animeQuery, epPart] = query.split("/episode");
  const animeName = animeQuery?.trim();
  const episodeNum = epPart?.trim();

  if (!animeName || !episodeNum) {
    return res.status(400).json({ status: "error", message: "Query must be like: naruto /episode 2" });
  }

  try {
    // 1. Search Anime
    const searchUrl = `https://animeheaven.me/search.php?title=${encodeURIComponent(animeName)}`;
    const searchRes = await axios.get(searchUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    const $ = cheerio.load(searchRes.data);
    const animePath = $(".series").first().find("a").attr("href");
    const animeTitle = $(".series").first().find("a").text().trim();
    if (!animePath) return res.status(404).json({ status: "error", message: "Anime not found" });

    const animeUrl = `https://animeheaven.me/${animePath}`;

    // 2. Get episodes
    const animePage = await axios.get(animeUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    const $$ = cheerio.load(animePage.data);
    const episodes = [];

    $$(".episode").each((_, el) => {
      const epText = $$(el).text().trim();
      const epHref = $$(el).attr("href");
      episodes.push({
        title: epText,
        url: `https://animeheaven.me/${epHref}`,
      });
    });

    const episode = episodes.find((ep) => ep.title.includes(`Episode ${episodeNum}`));
    if (!episode) return res.status(404).json({ status: "error", message: "Episode not found" });

    // 3. Get episode page
    const epPage = await axios.get(episode.url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    const $$$ = cheerio.load(epPage.data);
    const iframeSrc = $$$("iframe").attr("src");

    let videoLink = null;
    let thumbnail = null;

    if (iframeSrc) {
      const videoFrame = await axios.get(iframeSrc, {
        headers: { "User-Agent": "Mozilla/5.0", Referer: episode.url },
      });

      const fileMatch = videoFrame.data.match(/file:\s*"(https?:\/\/[^"]+\.(mp4|mkv))"/);
      const thumbMatch = videoFrame.data.match(/image:\s*"(https?:\/\/[^"]+\.(jpg|png))"/);

      if (fileMatch) videoLink = fileMatch[1];
      if (thumbMatch) thumbnail = thumbMatch[1];
    }

    res.json({
      status: "success",
      title: animeTitle,
      animeUrl,
      episode: {
        ...episode,
        video: videoLink,
        thumbnail,
      },
      source: "animeheaven.me",
    });
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Server error", error: err.message });
  }
}
