const axios = require('axios');
const cheerio = require('cheerio');

module.exports = async (req, res) => {
  const { query } = req.query;

  if (!query) {
    return res.status(400).json({ status: 'error', message: 'Query is required' });
  }

  const animepaheURL = `https://animepahe.ru/api?m=search&q=${encodeURIComponent(query)}`;
  const animeheavenURL = `https://animeheaven.me/search.php?title=${encodeURIComponent(query)}`;

  let results = [];

  try {
    // AnimePahe
    const paheRes = await axios.get(animepaheURL);
    const paheData = paheRes.data.data || [];

    if (paheData.length > 0) {
      paheData.forEach(anime => {
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

    // AnimeHeaven
    const heavenRes = await axios.get(animeheavenURL);
    const $ = cheerio.load(heavenRes.data);

    $('.series').each((i, el) => {
      const title = $(el).find('a').text().trim();
      const url = 'https://animeheaven.me/' + $(el).find('a').attr('href');
      const image = $(el).find('img').attr('src');

      results.push({
        title,
        image,
        sources: [
          {
            site: "AnimeHeaven",
            url
          }
        ]
      });
    });

    if (results.length === 0) {
      return res.status(404).json({
        status: "not_found",
        query,
        message: "No anime found"
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
