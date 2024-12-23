const axios = require('axios'); // Убедитесь, что axios установлен (npm install axios)

async function googleSearch(query) {
    const API_KEY = 'AIzaSyBsI4hVl4qeKOwSzLgoHoEINeONPe8AZTQ'; // Замените на ваш API-ключ Google Custom Search
    const CX = 'c5e231d3f71424c5f'; // Замените на ваш идентификатор поисковой системы

    const url = `https://www.googleapis.com/customsearch/v1`;

    try {
        const response = await axios.get(url, {
            params: {
                key: API_KEY,
                cx: CX,
                q: query,
            },
        });

        return response.data.items.map(item => ({
            title: item.title,
            links: item.link,
            snippet: item.snippet,
            displayedLink: item.displayLink,
        }));
    } catch (error) {
        console.error('Ошибка выполнения поиска:', error.message);
        throw error;
    }
}


module.exports = {
    googleSearch
};
