import axios from 'axios';
import cheerio from 'cheerio';

export default async function handler(req, res) {
  const { query } = req.query;
  if (!query) return res.status(400).json({ status: 'error', message: 'Query required' });

  const lower = query.toLowerCase();
  let animeName = query;
  let episodeNumber = null;

  // Handle "naruto season 1 /episode 2"
  if (lower.includes('/episode')) {
    const [name, ep] = lower.split('/episode');
    animeName = name.trim();
    episodeNumber = ep.trim();
  }

  try {
    // 1. Scrape from Anitaku
    const searchUrl = `https://anitaku.to/search.html?keyword=${encodeURIComponent(animeName)}`;
    const searchHtml = await axios.get(searchUrl).then(r => r.data);
    const $ = cheerio.load(searchHtml);

    const links = [];
    $('div.last_episodes ul.items li').each((i, el) => {
      const title = $(el).find('p.name a').text().trim();
      const url = 'https://anitaku.to' + $(el).find('p.name a').attr('href');
      links.push({ title, url });
    });

    if (links.length === 0) throw new Error('Anime not found');

    // 2. Get episode list from first match
    const animePage = await axios.get(links[0].url).then(r => r.data);
    const $$ = cheerio.load(animePage);

    const episodes = [];
    $$('#episode_page li a').each((i, el) => {
      const epNum = $$(el).attr('ep_start');
      if (epNum) {
        const epUrl = links[0].url.replace('category/', ''); // base path
        episodes.push({
          title: `${links[0].title} - Episode ${epNum}`,
          download: `https://anitaku.to${epUrl}-episode-${epNum}`,
          stream: `https://anitaku.to${epUrl}-episode-${epNum}`,
          quality: 'HD',
          thumbnail: 'https://img.anitaku.to/cover.jpg'
        });
      }
    });

    if (episodeNumber) {
      const ep = episodes.find(e => e.title.includes(`Episode ${episodeNumber}`));
      if (!ep) return res.status(404).json({ status: 'error', message: 'Episode not found' });
      return res.json({ status: 'success', source: 'anitaku', episode: ep });
    }

    res.json({ status: 'success', source: 'anitaku', episodes });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
}
