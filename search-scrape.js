const axios = require('axios'); // Убедитесь, что axios установлен (npm install axios)

async function googleSearch(query) {

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
