const puppeteer = require("puppeteer");
const Groq = require('groq-sdk');
const { search, translate } = require("@navetacandra/ddg");
const axios = require('axios');
const cheerio = require('cheerio');
const { googleSearch } = require("./search-scrape");
const OpenAI = require('openai');

const groq = new Groq({
    apiKey: "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"
});

const client = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: "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"
});

const { HfInference } = require("@huggingface/inference");

const inference = new HfInference("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");
const https = require('https');
const http = require('http');
const {re} = require("mathjs");
const {GoogleGenerativeAI, DynamicRetrievalMode} = require("@google/generative-ai");

const apiKey = "AIzaSyAZoN-8d2AUsOizf4uTPmFt2RzdNkxSrIk";
const genAI = new GoogleGenerativeAI(apiKey);

const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash-exp",
    systemInstruction: "Вы полезный ассистент.",
});

const SmartSearchBasicModel = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction: "Вы выводите КРАСИВО ОФОРМЛЕННЫЕ результаты умного поиска в интернете. Инструкции:\n- НЕ ГОВОРИТЕ НИЧЕГО О СЕБЕ (вы просто система, дающая ответы. на вопросы о том кто вы отвечайте что Вы - автономная система умного поиска разработанная компание SparkAI, которая использует сложные алгоритмы и llm от Google для получения ответа)\n- КРАСИВО ОФОРМЛЯЙТЕ ОТВЕТЫ\n\n- Отвечайте НА РУССКОМ ЯЗЫКЕ",
    },
);

const SmartSearchSummaryModel = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction: "Вы полезный ассистент, вы отвечаете на любой вопрос используйя контекст и ваши собственные знания. Инструкции:\n- Выдавайте только проверенную информацию (в предоставленном пользователем контексте всегда проверенная информация)\n- Красиво и понятно оформляйте ответы\n- Пишите не слишком много",
});

const generationConfig = {
    temperature: 1,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 8192,
    responseMimeType: "text/plain",
};

async function fetchPageText(url) {
    return new Promise((resolve, reject) => {
        if (!url) resolve("Похожая строка не найдена");
        const client = url.startsWith('https') ? https : http;

        console.log("getting text from the page..." + url)

        client.get(url, (res) => {
            let html = '';

            res.on('data', (chunk) => {
                html += chunk;
                console.log("received some text")
            });

            res.on('end', () => {
                console.log("done")
                try {
                    // Удаляем ненужные элементы и извлекаем текст
                    console.log("filtering...")
                    const visibleText = html
                        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                        .replace(/<!--[\s\S]*?-->/g, '')
                        .replace(/<\/?[^>]+(>|$)/g, '')
                        .split('\n')
                        .map(line => line.trim())
                        .filter(line => line.length > 0)
                        .join('\n');

                    console.log("done")

                    // Проверяем текст на наличие фраз, указывающих на проблему
                    if (isJavaScriptRequired(visibleText)) {
                        resolve("Похожая строка не найдена");
                    } else {
                        resolve(visibleText);
                    }
                } catch (err) {
                    resolve("Похожая строка не найдена");
                }
            });
        }).on('error', (err) => {
            resolve("Похожая строка не найдена");
        });
    });
}

function isJavaScriptRequired(text) {
    const patterns = [
        /enable javascript/i,
        /please enable javascript/i,
        /just a minute/i,
        /requires javascript/i,
        /javascript is disabled/i,
        /loading.../i
    ];

    // Проверяем текст на совпадение с известными паттернами
    return patterns.some(pattern => pattern.test(text));
}

function levenshtein(a, b) {
    const matrix = [];

    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // Замена
                    Math.min(matrix[i][j - 1] + 1, // Вставка
                        matrix[i - 1][j] + 1) // Удаление
                );
            }
        }
    }

    return matrix[b.length][a.length];
}

// Функция для поиска наиболее похожей строки и продолжения текста
function findClosestAndExtend(mainText, searchText, wordCount) {
    const mainWords = mainText.split(/\s+/);
    let bestMatchIndex = -1;
    let bestDistance = Infinity;

    if (mainText === "Похожая строка не найдена"){
        return "Похожая строка не найдена";
    }

    // Поиск самой похожей подстроки по расстоянию Левенштейна
    for (let i = 0; i <= mainWords.length - searchText.split(/\s+/).length; i++) {
        const candidate = mainWords.slice(i, i + searchText.split(/\s+/).length).join(' ');
        const distance = levenshtein(candidate.toLowerCase(), searchText.toLowerCase());

        if (distance < bestDistance) {
            bestDistance = distance;
            bestMatchIndex = i;
        }
    }

    if (bestMatchIndex === -1) {
        return "Похожая строка не найдена";
    }

    // Захватываем нужное количество слов после совпадения
    const resultWords = mainWords.slice(bestMatchIndex, bestMatchIndex + searchText.split(/\s+/).length + wordCount).join(' ');

    return resultWords;
}

async function searchDuckLinks(query = "") {
    const searchResults = await search({ query: query }, 'regular');

    return searchResults.results;
}

async function basicSearch(query = ""){
    const result = await searchDuckLinks(query);

    if (result && result.length > 0) {

        let answersString = "";

        for (const part of result)
        {
            answersString += "\n - " + part.description
        }

        console.log(answersString)

        return "Вот ответы на вопрос \"" + query + "\", который вы нашли в интернете: " + answersString
    } else {
        console.log("No results found.");
        return "";
    }
}

async function pageSummary(request = "prove expression does not depend on x", Question = "How to prove that an expression does not depend on x", maxWords = 3237, socket) {
    const searchResult = await searchDuckLinks(request);

    try {
        let neededText = "Похожая строка не найдена";
        let i = -1;

        // Этот цикл теперь ожидает завершения асинхронного вызова внутри цикла
        while (neededText === "Похожая строка не найдена" && i < searchResult.length) {
            i++;
            socket.emit('smart_answer_chunk', "Поиск..." + i);
            neededText = await fetchPageText(searchResult[i].url);
        }

        const chatCompletion = await groq.chat.completions.create({
            "messages": [
                {
                    "role": "system",
                    "content": neededText
                },
                {
                    "role": "user",
                    "content": request + " - " + Question + " Ответьте НА РУССКОМ ЯЗЫКЕ БЕЗ ГАЛЮЦИНАЦИЙ ИЛИ ВЫДУМАННОЙ ИНФОРМАЦИИ"
                }
            ],
            "model": "llama-3.1-8b-instant",
            "temperature": 0.5,
            "max_tokens": 1024,
            "top_p": 0.7,
            "stream": true,
            "stop": null
        });

        let finalAnswer = "";

        for await (const chunk of chatCompletion) {
            finalAnswer += chunk.choices[0]?.delta?.content || '';
            socket.emit('smart_answer_chunk', "## Найден ответ на вопрос в интернете:\n" + finalAnswer);
        }

        // Возвращаем результат
        return finalAnswer;

    } catch (error) {
        console.error('Error fetching the page:', error);
        return "";
    }
}

async function pageAnswer(question, socket, answerIndex) {
    const results = await googleSearch(question);

    const chatSession = SmartSearchSummaryModel.startChat({
        generationConfig,
        history: []
    });

    let pageText = "Похожая строка не найдена";

    for await (const result of results) {
        socket.emit('smart_answer_detailed_answer_chunk', {
            index: answerIndex,
            text: "Получение информации с сайта " + result.displayedLink
        });
        pageText = await fetchPageText(result.links);
        if (pageText !== "Похожая строка не найдена") break;
    }

    console.log(pageText)

    const stream = await chatSession.sendMessageStream("Ответьте на вопрос \"" + question + "\"\nКонтекст:\n" + pageText);

    let finalResult = "";

    for await (const chunk of stream.stream) {
        process.stdout.write(chunk.text() || '');
        finalResult += chunk.text() || '';
        socket.emit('smart_answer_detailed_answer_chunk', {
            index: answerIndex,
            text: finalResult
        });
    }
}


function pause(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}


async function smartSearch(question = "", socket){
    const chatSession = SmartSearchBasicModel.startChat({
        generationConfig,
        history: []
    });

    const searchResult = await googleSearch(question);

    socket.emit('smart_answer_links', searchResult);

    const stream = await chatSession.sendMessageStream(question);

    let finalResult = "";
    let detailedAnswers = []

    for await (const chunk of stream.stream) {
        process.stdout.write(chunk.text() || '');
        finalResult += chunk.text() || '';
        const json = extractJsonFields(finalResult);
        console.log(json)
        if (json.categories && json.categoriesRequests) {
            for (let i = 0; i < json.categoriesRequests.length; i++) {
                if (!detailedAnswers[i]) {
                    detailedAnswers[i] = {}; // Инициализируем объект, если его ещё нет
                }
                detailedAnswers[i].title = json.categories[i];
                detailedAnswers[i].content = json.categoriesRequests[i];
            }
        }
        socket.emit('smart_answer_chunk', {
            short: {
                text: json.short_answer,
                imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Stranger_Things_logo.png/260px-Stranger_Things_logo.png"
            },
            detailed: detailedAnswers
        });
    }

    return finalResult;
}

const extractJsonFields = (inputString) => {
    try {
        // Попробуем распарсить JSON как есть
        return JSON.parse(inputString);
    } catch (e) {
        // Если это не полный JSON, попытаемся восстановить данные
        const regex = /"([^"]+)"\s*:\s*(\[[^\]]*?\]|\{[^\}]*?\}|"(?:[^"\\]|\\.)*"|[^,\{\}\[\]]+)/g;
        let match;
        const result = {};

        while ((match = regex.exec(inputString)) !== null) {
            const key = match[1]; // Имя поля
            let value = match[2]; // Значение поля

            // Уберем кавычки для строк
            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.slice(1, -1);
            }

            // Попробуем преобразовать значение в массив, объект или число
            try {
                value = JSON.parse(value);
            } catch {
                // Если преобразование не удалось, оставляем как строку
            }

            result[key] = value;
        }

        return result;
    }
};
const parseRequests = (input) => {
    // Регулярное выражение для поиска всех действий и аргументов
    const regex = /\[([a-zA-Z-]+):"([^"]*)"\]/g;

    // Поиск всех совпадений
    const matches = input.matchAll(regex);

    // Преобразуем итератор в массив объектов
    const results = [];
    for (const match of matches) {
        results.push({
            action: match[1],
            argument: match[2],
        });
    }

    return results;
};

async function playgroundQuestion(question = "", socket, user, chat){

    if (socket) socket.emit('ai_playground_answer', '...');

    const chatSession = model.startChat({
        generationConfig,
        history: chat
    });

    const stream = await chatSession.sendMessageStream(question);

    let finalResult = "";

    for await (const chunk of stream.stream) {
        process.stdout.write(chunk.text() || '');
        finalResult += chunk.text() || '';
        socket.emit('ai_playground_answer_chunk', finalResult);
    }

    const actionResults = parseRequests(finalResult);
    if (actionResults.length > 0) {
        console.log("Обнаружены действия:");
        for (const item of actionResults) {
            const index = actionResults.indexOf(item);
            console.log(`Действие ${index + 1}: ${item.action}`);
            console.log(`Аргумент ${index + 1}: ${item.argument}`);
            if (item.action === "web-search") {
                const searchResult = await smartSearch(item.argument, socket);
            }
            if (item.action === "name-session") {
                if (socket) socket.emit("rename-current-session", item.argument);
            }
        }
    }

    chat.push({
        role: "user",
        parts: [{
            text: question
        }]
    })

    chat.push({
        role: "model",
        parts: [{
            text: finalResult
        }]
    });

    user.playgroundChat = chat;

    if (socket) socket.emit("ai_playground_answer-ready", chat);
}

async function editText(text = "", remark = "", socket, chat) {
    const chatSession = model.startChat({
        generationConfig,
        history: chat,
    });

    console.log(chat)

    const stream = await chatSession.sendMessageStream("Внесите правки \"" + remark + "\" в ваш ответ: \"" + text + "\"\nНАПИШИТЕ ТОЛЬКО ИСПРАВЛЕННЫЙ ОТВЕТ.");

    console.log("Внесите правки \"" + remark + "\" в ваш ответ: \"" + text + "\"\nНАПИШИТЕ ТОЛЬКО ИСПРАВЛЕННЫЙ ОТВЕТ.")

    let finalResult = "";

    for await (const chunk of stream.stream) {
        finalResult += chunk.text() || '';
        socket.emit('edited_answer_chunk', finalResult);
    }

    if (socket) socket.emit("edited_answer_chunk-ready", {
        initialText: text,
        editedText: finalResult
    });

    return finalResult;
}

let user = {};

user.playgroundChat = [];
user.useOpenrouter = true;

//playgroundQuestion("Создай игру текстовую rpg по типу сюжета как detroit become human и по атмосфере по типу фильма \"Бегущий по лезвию 2049\" с НЕВЕРОЯТНЫМ СЮЖЕТОМ, но только тут все будет крутиться вокруг ИИ-программы, \"живых\" ассистентов с реальными эмоциями, по типу \"Джой\" из \"Бегущий по лезвию 2049\". Выдай сюжет, всё по игре и несколько концепт артов, напиши код этой игры", null, user)

//playgroundQuestion("Придумай короткое стихотворение, а затем нарисуй иллюстрацию к нему", null, user)

module.exports = {
    smartSearch,
    playgroundQuestion,
    editText
};
