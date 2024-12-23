const {search, ResultTypes} = require("google-sr");
const axios = require("axios");
const cheerio = require("cheerio");
const levenshtein = require("fast-levenshtein");
const https = require("https");
const Groq = require('groq-sdk');
const express = require('express');
const { ocrSpace } = require('ocr-space-api-wrapper');
const {convert} = require("html-to-text");


const agent = new https.Agent({ rejectUnauthorized: false });

const groq = new Groq({
    apiKey: "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"
});


async function SearchLinks(query = "", socket) {

    const searchResults = await search({
        query: query,
        safeMode: false,
        filterResults: [ResultTypes.SearchResult]
    });

    if (searchResults.length === 0) {
        console.log('No results found.');
        socket.emit('search_answer', 'No results found.');
        return;
    }

    console.log(searchResults)

    let Sources = [];

    // Проход по страницам
    for (let i = 0; i < searchResults.length; i++) {
        Sources.push({
            "url": searchResults[i].link,
            "name": searchResults[i].title
        });
    }

    // Отправляем текст для генерации ответа
    const chatCompletion = await groq.chat.completions.create({
        "messages": [
            {
                "role": "system",
                "content": "ВЫ ОТВЕЧАЕТЕ ТОЛЬКО НА РУССКОМ ЯЗЫКЕ"
            },
            {
                "role": "user",
                "content": "Исходя из предоставленной информации каждой страницы сайта (название сайта, сам сайт) и описание каждой страницы НА РУССКОМ ЯЗЫКЕ, что будет важно для поиска ответа на вопрос \"" + query + "\"Напишите описания каждого сайта (элемента) - описание вкратце информации, которую они предлагают.  Название сайтов выделяйте с двух сторон двумя знаками ** (кроме названий сайтов больше так ничего не выделяйте). Названия сайтов могут быть частью текста. Между двумя элементами ставьте знак $. Кроме описания элементов БОЛЬШЕ НИЧЕГО НЕ ПИШИТЕ. Вот все элементы:\n" + searchResults.toString()
            },
        ],
        "model": "llama3-8b-8192",
        "temperature": 0.7,
        "max_tokens": 1024,
        "top_p": 1,
        "stream": true,
        "stop": null
    });

    let finalAnswer = '';


    for await (const chunk of chatCompletion) {
        process.stdout.write(chunk.choices[0]?.delta?.content || '');

        finalAnswer += chunk.choices[0]?.delta?.content;

        socket.emit('search_answer', {
            response: finalAnswer,
            sources: Sources
        });
    }
}

async function searchLinks(query = "", limit = "1") {
    try {
        const data = "no data";
        console.log(data.data);
        return data.data;
    } catch (error) {
        console.error("Error during search:", error);
        throw error;
    }
}


async function Search(query = "", numSentences = 60, url, socket, user) {

    if (!user) {
        console.error('User object is not provided.');
        socket.emit('smart_search_answer', 'User object is not provided.');
        return;
    }
    if (!user.searchChat) {
        user.searchChat = [];
    }

    let allExcerpts = "";

        try {
            const response = await axios.get(url, { httpsAgent: agent });
            const html = response.data;
            const $ = cheerio.load(html);

            // Извлечение видимого текста со страницы
            const visibleText = $('body').text();

            // Определение позиции, начиная с 20% от общего текста
            const startIdx = 1000;

            // Получение текста начиная с 20% Zот общего объема
            const textFromStart = visibleText.slice(startIdx);

            // Разбиение текста на предложения
            const sentences = textFromStart.match(/[^.!?]+[.!?]+/g) || [];

            // Если предложения найдены, добавляем первые numSentences предложений в allExcerpts
            if (sentences.length > 0) {
                const excerpt = sentences.slice(0, numSentences).join(' ').trim();
                allExcerpts += excerpt + "\n";
            }
        } catch (error) {
            socket.emit('smart_search_answer', 'Error fetching the page:' + error);
            console.error('Error fetching the page:', error);
        }


    // Если никаких отрывков не найдено, выводим сообщение
    if (allExcerpts === "") {
        console.log('No relevant excerpts found.');
        socket.emit('smart_search_answer', 'No relevant excerpts found.');
        return;
    }

    console.log(allExcerpts)

    // Отправляем текст для генерации ответа
    const chatCompletion = await groq.chat.completions.create({
        "messages": [
            {
                "role": "system",
                "content": "Вы доносите информацию для пользователей о любом их вопросе. Ваша информация и ответы должны быть НЕВЕРОЯТНО ТОЧНЫ и ПОНЯТНЫ любому. Если вы НЕ ЗАНЕТЕ ответа или информации о нём не предоставлено - ОТВЕЧАЙТЕ ИСПОЛЬЗУЯ ТО, ЧТО ЕСТЬ. Ваша цель предоставить пользователю ВКРАТЦЕ В ОДНОМ НЕБОЛЬШОМ АБЗАЦЕ проверенную и полезную по вопросу информацию. Если у вас ЕСТЬ ЧТО-ТО ВАЖНОЕ ЧТОБЫ ДОБАВИТЬ и ВЫ ЗНАЕТЕ ЧТО ЭТО ПРАВДА, ДОБАВЛЯЙТЕ ЭТУ ИНФОРМАЦИЮ. Вы отвечаете БЕЗ ВАШИХ КОМЕНТАРИЕВ, ТОЛЬКО ФАКТЫ. Ваши ответы, как будто обрывки интересной статьи. вы говорите ТОЛЬКО НА РУССКОМ ЯЗЫКЕ"
            },
            {
                "role": "user",
                "content": "ВКРАТЦЕ В ОДНОМ НЕБОЛЬШОМ АБЗАЦЕ и с красивым оформлением ответьте на вопрос \"" + query + "\" НА РУССКОМ ЯЗЫКЕ, НЕ ПИШИТЕ НИЧЕГО НА ДРУГИХ ЯЗЫКАХ КРОМЕ РУССКОГО. используйте информацию (код сайта с информацией):\n" + allExcerpts
            },
        ],
        "model": "llama3-8b-8192",
        "temperature": 0.5,
        "max_tokens": 8192,
        "top_p": 1,
        "stream": true,
        "stop": null
    });

    let finalAnswer = '';


    for await (const chunk of chatCompletion) {
        process.stdout.write(chunk.choices[0]?.delta?.content || '');

        finalAnswer += chunk.choices[0]?.delta?.content;

        socket.emit('smart_search_answer', {
            response: finalAnswer,
        });
    }

    user.searchChat = [
        {
            "role": "system",
            "content": "Вы доносите информацию для пользователей о любом их вопросе. Ваша информация и ответы должны быть НЕВЕРОЯТНО ТОЧНЫ и ПОНЯТНЫ любому. Если вы НЕ ЗАНЕТЕ ответа или информации о нём не предоставлено - ОТВЕЧАЙТЕ ИСПОЛЬЗУЯ ТО, ЧТО ЕСТЬ. Ваша цель предоставить пользователю КАК МОЖНО БОЛЬШЕ проверенной и полезной по вопросу информации. Если у вас ЕСТЬ ЧТО ДОБАВИТЬ и ВЫ ЗНАЕТЕ ЧТО ЭТО ПРАВДА, ДОБАВЛЯЙТЕ ЭТУ ИНФОРМАЦИЮ. Вы отвечаете БЕЗ ВАШИХ КОМЕНТАРИЕВ, ТОЛЬКО ФАКТЫ. Ваши ответы, как будто обрывки интересной статьи. вы говорите ТОЛЬКО НА РУССКОМ ЯЗЫКЕ"
        },
        {
            "role": "user",
            "content": "Развёрнуто (и с красивым оформлением) ответьте на вопрос \"" + query + "\" используя информацию:\n" + allExcerpts
        },
        {
            "role": "assistant",
            "content": finalAnswer
        },
    ]
}

async function answerFromURL(url =  "", question = ""){

    let allExcerpts = "";

    try {
        const response = await axios.get(url, { httpsAgent: agent });
        const html = response.data;

        allExcerpts = convert(html, {
            wordwrap: 130 // Ширина строки (можно настроить)
        });

    } catch (error) {
        //socket.emit('smart_search_answer', 'Error fetching the page:' + error);
        console.error('Error fetching the page:', error);
    }

    console.log(allExcerpts)


    // Отправляем текст для генерации ответа
    const chatCompletion = await groq.chat.completions.create({
        "messages": [
            {
                "role": "system",
                "content": "Вы доносите информацию для пользователей о любом их вопросе. Ваша информация и ответы должны быть НЕВЕРОЯТНО ТОЧНЫ и ПОНЯТНЫ любому. Если вы НЕ ЗАНЕТЕ ответа или информации о нём не предоставлено - ОТВЕЧАЙТЕ ИСПОЛЬЗУЯ ТО, ЧТО ЕСТЬ. Ваша цель предоставить пользователю В ОДНО КОРОТКОЕ ПРЕДЛОЖЕНИЕ проверенную и полезную по вопросу информацию. Вы отвечаете БЕЗ ВАШИХ КОМЕНТАРИЕВ, ТОЛЬКО ФАКТЫ. Ваши ответы, как будто обрывки интересной статьи. DO NOT HALLUCINATE! вы говорите ТОЛЬКО НА РУССКОМ ЯЗЫКЕ"
            },
            {
                "role": "user",
                "content": "КАКОЙ ОТВЕТ НА ВОПРОС \"" + question + "\" в ДАННОМ ТЕКСТЕ ИНФОРМАЦИИ. используйте информацию (код сайта с информацией). ОТВЕТЬТЕ ОЧЕНЬ КРАТКО И ПОНЯТНО, В ОДНО КОРОТКОЕ ПРЕДЛОЖЕНИЕ. Вот информация:\n" + allExcerpts
            },
        ],
        "model": "llama3-8b-8192",
        "temperature": 0.5,
        "max_tokens": 8192,
        "top_p": 1,
        "stream": true,
        "stop": null
    });

    let finalAnswer = "";

    for await (const chunk of chatCompletion) {
        process.stdout.write(chunk.choices[0]?.delta?.content || '');

        finalAnswer += chunk.choices[0]?.delta?.content;
    }

    return finalAnswer;
}


async function HomeworkSearch(query = "", numSentences = 60, socket, user) {

    try {
        // Using the OCR.space default free API key (max 10reqs in 10mins) + remote file
        const res1 = await ocrSpace('./image.png', {apiKey: 'K87300326988957', language: "rus"});

        console.log(res1)

        const searchResults = await search({
            query: query,
            safeMode: false,
            filterResults: [ResultTypes.SearchResult]
        });

        if (searchResults.length === 0) {
            console.log('No results found.');
            socket.emit('search_answer', 'No results found.');
            return;
        }

        console.log(searchResults)

        let Sources = [];

        // Проход по страницам
        for (let i = 0; i < searchResults.length; i++) {
            Sources.push({
                "url": searchResults[i].link,
                "name": searchResults[i].title
            });
        }

        const url = searchResults[0];

        if (!user) {
            console.error('User object is not provided.');
            socket.emit('smart_search_answer', 'User object is not provided.');
            return;
        }
        if (!user.searchChat) {
            user.searchChat = [];
        }

        let allExcerpts = "";

        try {
            const response = await axios.get(url, { httpsAgent: agent });
            const html = response.data;
            const $ = cheerio.load(html);

            // Извлечение видимого текста со страницы
            const visibleText = $('body').text();

            // Определение позиции, начиная с 20% от общего текста
            const startIdx = 1000;

            // Получение текста начиная с 20% Zот общего объема
            const textFromStart = visibleText.slice(startIdx);

            // Разбиение текста на предложения
            const sentences = textFromStart.match(/[^.!?]+[.!?]+/g) || [];

            // Если предложения найдены, добавляем первые numSentences предложений в allExcerpts
            if (sentences.length > 0) {
                const excerpt = sentences.slice(0, numSentences).join(' ').trim();
                allExcerpts += excerpt + "\n";
            }
        } catch (error) {
            socket.emit('smart_search_answer', 'Error fetching the page:' + error);
            console.error('Error fetching the page:', error);
        }


        // Если никаких отрывков не найдено, выводим сообщение
        if (allExcerpts === "") {
            console.log('No relevant excerpts found.');
            socket.emit('smart_search_answer', 'No relevant excerpts found.');
            return;
        }

        console.log(allExcerpts)

        // Отправляем текст для генерации ответа
        const chatCompletion = await groq.chat.completions.create({
            "messages": [
                {
                    "role": "system",
                    "content": "Вы доносите информацию для пользователей о любом их вопросе. Ваша информация и ответы должны быть НЕВЕРОЯТНО ТОЧНЫ и ПОНЯТНЫ любому. Если вы НЕ ЗАНЕТЕ ответа или информации о нём не предоставлено - ОТВЕЧАЙТЕ ИСПОЛЬЗУЯ ТО, ЧТО ЕСТЬ. Ваша цель предоставить пользователю ВКРАТЦЕ В ОДНОМ НЕБОЛЬШОМ АБЗАЦЕ проверенную и полезную по вопросу информацию. Если у вас ЕСТЬ ЧТО-ТО ВАЖНОЕ ЧТОБЫ ДОБАВИТЬ и ВЫ ЗНАЕТЕ ЧТО ЭТО ПРАВДА, ДОБАВЛЯЙТЕ ЭТУ ИНФОРМАЦИЮ. Вы отвечаете БЕЗ ВАШИХ КОМЕНТАРИЕВ, ТОЛЬКО ФАКТЫ. Ваши ответы, как будто обрывки интересной статьи. вы говорите ТОЛЬКО НА РУССКОМ ЯЗЫКЕ"
                },
                {
                    "role": "user",
                    "content": "ВКРАТЦЕ В ОДНОМ НЕБОЛЬШОМ АБЗАЦЕ ответьте на вопрос \"" + query + "\" НА РУССКОМ ЯЗЫКЕ, НЕ ПИШИТЕ НИЧЕГО НА ДРУГИХ ЯЗЫКАХ КРОМЕ РУССКОГО. используйте информацию (код сайта с информацией):\n" + allExcerpts
                },
            ],
            "model": "llama3-8b-8192",
            "temperature": 0.5,
            "max_tokens": 8192,
            "top_p": 1,
            "stream": true,
            "stop": null
        });

        let finalAnswer = '';


        for await (const chunk of chatCompletion) {
            process.stdout.write(chunk.choices[0]?.delta?.content || '');

            finalAnswer += chunk.choices[0]?.delta?.content;

            socket.emit('smart_search_answer', {
                response: finalAnswer,
            });
        }

        user.searchChat = [
            {
                "role": "system",
                "content": "Вы доносите информацию для пользователей о любом их вопросе. Ваша информация и ответы должны быть НЕВЕРОЯТНО ТОЧНЫ и ПОНЯТНЫ любому. Если вы НЕ ЗАНЕТЕ ответа или информации о нём не предоставлено - ОТВЕЧАЙТЕ ИСПОЛЬЗУЯ ТО, ЧТО ЕСТЬ. Ваша цель предоставить пользователю КАК МОЖНО БОЛЬШЕ проверенной и полезной по вопросу информации. Если у вас ЕСТЬ ЧТО ДОБАВИТЬ и ВЫ ЗНАЕТЕ ЧТО ЭТО ПРАВДА, ДОБАВЛЯЙТЕ ЭТУ ИНФОРМАЦИЮ. Вы отвечаете БЕЗ ВАШИХ КОМЕНТАРИЕВ, ТОЛЬКО ФАКТЫ. Ваши ответы, как будто обрывки интересной статьи. вы говорите ТОЛЬКО НА РУССКОМ ЯЗЫКЕ"
            },
            {
                "role": "user",
                "content": "Развёрнуто (и с красивым оформлением) ответьте на вопрос \"" + query + "\" используя информацию:\n" + allExcerpts
            },
            {
                "role": "assistant",
                "content": finalAnswer
            },
        ]
    } catch (error) {
        console.error(error);
    }
}

async function refineSearch(query = "", socket, user){
    // Отправляем текст для генерации ответа
    const chatCompletion = await groq.chat.completions.create({
        "messages": [
            ...user.searchChat,
            {
                "role": "user",
                "content": query
            },
        ],
        "model": "llama3-8b-8192",
        "temperature": 0.5,
        "max_tokens": 3024,
        "top_p": 1,
        "stream": true,
        "stop": null
    });

    let finalAnswer = '';

    for await (const chunk of chatCompletion) {
        process.stdout.write(chunk.choices[0]?.delta?.content || '');

        finalAnswer += chunk.choices[0]?.delta?.content;
    }

    user.searchChat.push(
        {
            "role": "user",
            "content": query
        },
        {
            "role": "assistant",
            "content": finalAnswer
        },
    );

    socket.emit('refine_answer', {
        response: finalAnswer,
    });
}

module.exports = {
    Search,
    refineSearch,
    SearchLinks,
    searchLinks,
    answerFromURL
};
