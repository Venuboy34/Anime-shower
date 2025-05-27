const axios = require('axios');
const cheerio = require('cheerio');

module.exports = async (req, res) => {
  const { query } = req.query;

  if (!query) {
    return res.status(400).json({ status: 'error', message: 'Query is required' });
  }

  const gogoURL = `https://gogoanime.pe//search.html?keyword=${encodeURIComponent(query)}`;
  const animepaheURL = `https://animepahe.ru/api?m=search&q=${encodeURIComponent(query)}`;

  let results = [];

  try {
    // GogoAnime Scraper
    const gogoRes = await axios.get(gogoURL);
    const $ = cheerio.load(gogoRes.data);

    $('.last_episodes > ul > li').each((i, el) => {
      const title = $(el).find('p.name a').text().trim();
      const url = 'https://gogoanime.pe' + $(el).find('p.name a').attr('href');
      const image = $(el).find('.img a img').attr('src');

      results.push({
        title,
        image,
        sources: [
          {
            site: "GogoAnime",
            url
          }
        ]
      });
    });

    // AnimePahe Scraper
    const paheRes = await axios.get(animepaheURL);
    if (paheRes.data.data && paheRes.data.data.length > 0) {
      paheRes.data.data.forEach(anime => {
        results.push({
          title: anime.title,
          image: anime.poster,
          sources: [
            {
              site: "AnimePahe",
              url: `https://animepahe.ru/anime/${anime.session}`
            }
          ]
        });
      });
    }

    res.status(200).json({
      status: "success",
      query,
      results
    });

  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};
