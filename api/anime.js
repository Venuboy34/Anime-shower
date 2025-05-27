const axios = require("axios");
const cheerio = require("cheerio");

async function getAnimeHeavenEpisode(animeName, episodeNum) {
  try {
    const searchUrl = `https://animeheaven.me/search.php?title=${encodeURIComponent(animeName)}`;
    const response = await axios.get(searchUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    const $ = cheerio.load(response.data);
    const firstResult = $(".series").first();
    if (!firstResult.length) return null;

    const title = firstResult.find("a").text().trim();
    const animeUrl = "https://animeheaven.me/" + firstResult.find("a").attr("href");

    const animePage = await axios.get(animeUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    const $$ = cheerio.load(animePage.data);
    const episodes = [];

    $$(".episode").each((_, el) => {
      const epTitle = $$(el).text().trim();
      const epUrl = "https://animeheaven.me/" + $$(el).attr("href");
      episodes.push({ title: epTitle, url: epUrl });
    });

    const episode = episodes.find((ep) => ep.title.includes(`Episode ${episodeNum}`));
    if (!episode) return null;

    const videoPage = await axios.get(episode.url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    const $$$ = cheerio.load(videoPage.data);
    const iframe = $$$("iframe").attr("src");
    if (!iframe) return { ...episode, video: null };

    const finalRes = await axios.get(iframe, {
      headers: { Referer: episode.url, "User-Agent": "Mozilla/5.0" },
    });

    const match = finalRes.data.match(/file:\s*"(https?:\/\/[^"]+\.(mp4|mkv))"/);
    const thumbMatch = finalRes.data.match(/image:\s*"(https?:\/\/[^"]+\.(jpg|png))"/);

    return {
      title,
      animeUrl,
      episode: {
        title: episode.title,
        url: episode.url,
        video: match ? match[1] : null,
        thumbnail: thumbMatch ? thumbMatch[1] : null,
      },
      source: "animeheaven",
    };
  } catch {
    return null;
  }
}

async function getZoroFallback(animeName, episodeNum) {
  // Dummy fallback example
  return {
    title: animeName,
    animeUrl: `https://zoro.to/search?keyword=${encodeURIComponent(animeName)}`,
    episode: {
      title: `Episode ${episodeNum}`,
      url: `https://zoro.to/${animeName.replace(/\s+/g, "-").toLowerCase()}-episode-${episodeNum}`,
      video: null,
      thumbnail: null,
    },
    source: "zoro (fallback)",
  };
}

module.exports = async (req, res) => {
  const { query } = req.query;
  if (!query) return res.status(400).json({ status: "error", message: "Query is required" });

  const [animeQuery, episodeQueryRaw] = query.split("/episode");
  const animeName = animeQuery.trim();
  const episodeNum = episodeQueryRaw ? parseInt(episodeQueryRaw.trim()) : null;

  if (!episodeNum) {
    return res.status(400).json({ status: "error", message: "Please provide like: naruto season 1 /episode 2" });
  }

  const result = await getAnimeHeavenEpisode(animeName, episodeNum) || await getZoroFallback(animeName, episodeNum);

  if (!result) return res.status(404).json({ status: "error", message: "Episode not found" });

  return res.json({
    status: "success",
    ...result,
  });
};
