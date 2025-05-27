import axios from "axios";
import * as cheerio from "cheerio";

export default async function handler(req, res) {
  const { query } = req.query;
  if (!query) return res.status(400).json({ status: "error", message: "Use ?query=anime name" });

  const raw = query.trim();
  const match = raw.match(/(.+)\/episode\s*(\d+)/i);
  const animeTitle = match ? match[1].trim() : raw;
  const episodeNumber = match ? parseInt(match[2]) : null;

  const sources = [fetchFromAnimeHeaven, fetchFromKissAnime, fetchFromAnitaku];
  for (const source of sources) {
    try {
      const result = await source(animeTitle, episodeNumber);
      if (result) return res.json(result);
    } catch (err) {
      console.warn(`${source.name} failed:`, err.message);
    }
  }

  return res.status(404).json({ status: "error", message: "Anime not found" });
}

function formatResult(source, title, episodes, epNum) {
  if (epNum) {
    const found = episodes.find(e => e.title.toLowerCase().includes(`episode ${epNum}`));
    if (!found) throw new Error("Episode not found");
    return { status: "success", source, title, episode: found };
  } else {
    return { status: "success", source, title, episodes };
  }
}

async function fetchFromAnimeHeaven(name, epNum) {
  const searchUrl = `https://animeheaven.me/search.php?title=${encodeURIComponent(name)}`;
  const res = await axios.get(searchUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
  const $ = cheerio.load(res.data);
  const link = $(".series a").attr("href");
  if (!link) throw new Error("Not found");

  const page = await axios.get(`https://animeheaven.me/${link}`, { headers: { "User-Agent": "Mozilla/5.0" } });
  const $$ = cheerio.load(page.data);
  const thumbnail = $$("div.cover img").attr("src");
  const episodes = $$("a.episode").toArray().map(el => {
    const href = $$(el).attr("href");
    return {
      title: $$(el).text().trim(),
      url: `https://animeheaven.me/${href}`,
      download: `https://animeheaven.me/${href}`, // usually same
      quality: "720p"
    };
  });

  return formatResult("animeheaven.me", name, episodes.map(e => ({ ...e, thumbnail })), epNum);
}

async function fetchFromKissAnime(name, epNum) {
  const searchUrl = `https://kissanime.com.ru/Search/Anime?q=${encodeURIComponent(name)}`;
  const res = await axios.get(searchUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
  const $ = cheerio.load(res.data);
  const animeUrl = $("a[href*='/Anime/']").first().attr("href");
  if (!animeUrl) throw new Error("Not found");

  const page = await axios.get(`https://kissanime.com.ru${animeUrl}`, {
    headers: { "User-Agent": "Mozilla/5.0" }
  });
  const $$ = cheerio.load(page.data);
  const thumbnail = $$("div.anime_info_body_bg img").attr("src");
  const episodes = $$("a")
    .toArray()
    .filter(el => $$(el).attr("href")?.includes("/Episode/"))
    .map(el => {
      const href = $$(el).attr("href");
      return {
        title: $$(el).text().trim(),
        url: `https://kissanime.com.ru${href}`,
        download: `https://kissanime.com.ru${href}`,
        quality: "480p"
      };
    });

  return formatResult("kissanime.com.ru", name, episodes.map(e => ({ ...e, thumbnail })), epNum);
}

async function fetchFromAnitaku(name, epNum) {
  const searchUrl = `https://anitaku.to/search.html?keyword=${encodeURIComponent(name)}`;
  const res = await axios.get(searchUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
  const $ = cheerio.load(res.data);
  const animeUrl = $(".name a").first().attr("href");
  if (!animeUrl) throw new Error("Not found");

  const page = await axios.get(animeUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
  const $$ = cheerio.load(page.data);
  const thumbnail = $$("div.anime_info_body_bg img").attr("src");
  const episodes = $$("ul#episode_related li a").toArray().map(el => {
    const href = $$(el).attr("href");
    return {
      title: $$(el).text().trim(),
      url: "https://anitaku.to" + href,
      download: "https://anitaku.to" + href,
      quality: "1080p"
    };
  });

  return formatResult("anitaku.to", name, episodes.map(e => ({ ...e, thumbnail })), epNum);
}
