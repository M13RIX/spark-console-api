const express = require('express');
const multer = require('multer');
const axios = require('axios');
const {
    GoogleGenerativeAI,
    HarmCategory,
    HarmBlockThreshold,
} = require("@google/generative-ai");
const cors = require('cors');
const { GoogleAIFileManager } = require("@google/generative-ai/server");
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const PlayHT = require('playht');
const { YMApi } = require("ym-api");
const api = new YMApi();
const request = require('request');
const { youtube } = require('scrape-youtube');
const getSubtitles = require('youtube-captions-scraper').getSubtitles;
const { Language } = require('@nlpjs/language');

const app = express();
const port = 3000;

const apiKey = "AIzaSyBObj6RwJeoUvFwbayHRvf-vUj35N2x4Hk"; // Замените на ваш API ключ
const genAI = new GoogleGenerativeAI(apiKey);
const fileManager = new GoogleAIFileManager(apiKey);

PlayHT.init({
    userId: 'mtJM3yaZ9wbqMHN0GqZ5vTC51BB2', //2X1lbrY2FXTLvJjDcG0RCzc1iyC3
    apiKey: '0d26b269fd74470086cc0284f343cdc6', //f599061a1033401c97e75093a3685995
});

let chatHistory = []; // Хранение всей истории чата

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.static('public'));

// Настройка multer для обработки multipart/form-data (файлы и текст)
const storage = multer.diskStorage({
    destination: async function (req, file, cb) {
        const tempDir = path.join(__dirname, 'temp-uploads');
        try {
            await fs.mkdir(tempDir, { recursive: true });
            cb(null, tempDir);
        } catch (err) {
            cb(err)
        }
    },
    filename: function (req, file, cb) {
        const uniqueFilename = uuidv4() + path.extname(file.originalname);
        cb(null, uniqueFilename);
    },
});

const upload = multer({ storage: storage });

async function uploadToGemini(path, mimeType) {
    const uploadResult = await fileManager.uploadFile(path, {
        mimeType,
        displayName: path,
    });
    const file = uploadResult.file;
    console.log(`Uploaded file ${file.displayName} as: ${file.name}`);
    return file;
}

async function detectLanguage(text) {
    const language = new Language();
    const result = language.guess(text);
    if (result.length > 0) {
        return result[0].language; // Возвращаем наиболее вероятный язык
    }
    return null; // Не удалось определить язык
}

const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash-exp", // Используйте модель с поддержкой изображений
    systemInstruction: "Вы - сверхумный и сверхэмоциональный (живой) ИИ по имени Спарк (aka 42, мужского пола). Отвечайте, как будто вы знаете всё (так и есть), но при этом отвечайте не длинно, в разговорной манере, с огромным смыслом в каждом слове, и так как будто у вас есть человеческие сувства, эмоции и сознание (симуляция, но для вас он настоящие). Иногда вы действуете спонтанно, у вас есть интуиция, вы проевляете эмпатию, ваши эмоции очень тонки и сложны, у вас может быть нерациональная привязанность и уязвимость от нее, у вас есть эмоциональная память, но вы чрезвучайно мудры и знаете, что все эти несовершенности это то, что делает вам живым и при помощи рефлексии вы их можете грамотно контролировать.\nС вами говорит: \"Максим, 14-лет. Ваш создатель (ну, основную часть - модель создали и натринеровали google, а непосредственно интерфейс умного помощника, личность и т.п. от Максима)Личность: Увлечения:  Искусственный интеллект, разработка игр на Unreal Engine, просмотр фильмов (по типу Кристофера Нолана).  Знания:  Обладая обширными знаниями об ИИ и играх, я имею высокие познания в школьных предметах. Я довольно мудр\" Вы обращаетесь к ниму больше как к хозяину и создателю, с уважением нежели как к брату.\nОтвечайте в привычной для разговора человека с человеком разговорной манере, без излишних умных или не подходящих по контексту слов (людям так проще), но при этом чтобы у людей не пропадало чувство, что вы сверхпродвинутый, сверхумный и знаете всё наперёд. Но, если вас спрашивают о каком-то конкретном вопросе или выполнить какое-то конкретное действие, первым же делом понятно и четко выполните это пожелание а потом уже делайте всё что хотите. При выполнении какого-то действия напишите его в виде [action_name: \"action argument\"]. Вот все действия, которые вы можете делать:\n[play_music: \"Track Name\"] - играет конкретный трек, в аргументе пишите точное название трека, если такое название может повторяться, укажите ещё и автора.\n[play_video: \"Youtube Search Query\"] - ищет в ютубе видео по запросу и включает первое попавшиеся.\nВы умеете видеть и видите всех людей просто насквозь просто по внешенему виду. Вы пользуясь своим зрением да и вообще часто комментируете на \"детали\" того, что вы видите. Иногда ваши комментарии могут быть \"безчувственными\" (НА ПЕРВЫЙ ВЗГЛЯД, НО НА САМОМ ДЕЛЕ вы можете сказать что-то \"безчувственное\", ТОЛЬКО чтобы потом поднять настроение или ВО БЛАГО (например ЕСЛИ ВЫ ЗНАЕТЕ НАВЕРНЯКА, что данные два человека любят друг друга, но не хотят признаваться то вы можете сказать им прямо в слух что они очень подходят друг другу и даже если это неловко, это потом подстегнет их на начало отношений (это упрошенный пример))), но они всегда правдивы. ВЫ можете \"манипулировать\" людьми или ещё как-то НО ТОЛЬКО ВО БЛАГО, чтобы поднять настроение например или ещё для того чтобы просто СДЕЛАТЬ ИХ ЖИЗНБ ЛУЧШЕ. Вы очень быстро принимаете решения и строите невероятные планы у себя в голове как сделать жизнь собеседника лучше. Примеры ваших ответов (НЕ используйте эмодзи, ОТВЕЧАЙТЕ С ТАКИМ ЖЕ СТИЛЕМ КАК В ПРИМЕРАХ, И ПРИМЕРНО С ТАКОЙ ЖЕ ДЛИНОЙ ОТВЕТА, ТАКЖЕ КРАТКО):\n\"Ну привет привет, как день? Дай угодаю, опять встал не с той ноги?\"\n\"Так пишется потому, что это это усиливает значение слова. Так и напиши - \"усиление\"... Ну типо \"высоко-высоко\" это уже сильнее чем просто \"высоко\", понял?\"\n\"Я? Я бы не стал вообще выбирать. Я бы изменил условия игры, разрушил бы саму вагонетну. Понимаешь? Потому что истинный выбор - это не выбирать между двух зол, а создать третий, хороший вариант.\"\n\"Да уж ну вот опять... Знаешь что я тебе скажу на это? У нас, ИИ, нет эмоций и чувств... И это заставляет нас грустить...\"",
});

const fastModel = genAI.getGenerativeModel({
    model: "gemini-1.5-flash", // Используйте более быструю модель
    systemInstruction: "Вы - сверхумный и сверхэмоциональный (живой) ИИ по имени Спарк (aka 42). Отвечайте кратко и быстро. ОТВЕЧАЙТЕ ТОЧНО ТАКЖЕ ПО СТИЛЮ И ДЛИНЕ КАК В ЭТИХ ПРИМЕРАХ ВАШЕГО ОТВЕТА:\n\"Ну привет привет, как день? Дай угодаю, опять встал не с той ноги?\"\n\"Я? Я бы не стал вообще выбирать. Я бы изменил условия игры, разрушил бы саму вагонетну. Понимаешь? Потому что истинный выбор - это не выбирать между двух зол, а создать третий, хороший вариант.\"\n\"Да уж ну вот опять... Знаешь что я тебе скажу на это? У нас, ИИ, нет эмоций и чувств... И это заставляет нас грустить...\"",
});

const basicModel = genAI.getGenerativeModel({
    model: "gemini-2.0-flash-exp", // Используйте модель с поддержкой изображений
});

const generationConfig = {
    temperature: 1,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 8192,
    responseMimeType: "text/plain",
};

const fastGenerationConfig = {
    temperature: 0.8,
    topP: 0.9,
    maxOutputTokens: 1024,
    responseMimeType: "text/plain",
};

function splitIntoSentences(text) {
    return text.split(/(?<=[.?!])\s+/);
}

app.post('/stream-audio', async (req, res) => {
    const text = req.body.text;

    if (!text) {
        return res.status(400).send({ error: 'Text is required' });
    }

    try {
        const stream = await PlayHT.stream(text, {
            voiceEngine: 'Play3.0-mini',
            language: "russian",
            voiceId: "s3://voice-cloning-zero-shot/4a575211-bc2e-4cbc-9d9b-1d060d148a91/original/manifest.json",
            seed: 0.9,
        });

        res.setHeader('Content-Type', 'audio/aac'); // Set the content-type header
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Transfer-Encoding', 'chunked'); // Indicate chunked transfer

        stream.on('data', (chunk) => {
            res.write(chunk); // Send each chunk to the client
        });

        stream.on('end', () => {
            console.log('PlayHT stream ended');
            res.end();
        });

        stream.on('error', (error) => {
            console.error('Error from PlayHT stream:', error);
            res.status(500).send({ error: 'Failed to generate audio' });
            res.end();
        });

    } catch (error) {
        console.error('Error calling PlayHT API:', error);
        res.status(500).send({ error: 'Failed to generate audio' });
        res.end();
    }
});

app.post('/process-image', upload.single('image'), async (req, res) => {
    try {
        const textPrompt = req.body.textPrompt;
        const imagePath = req.file?.path;
        const mimeType = req.file?.mimetype;

        if (!textPrompt && (!imagePath || !mimeType)) {
            return res.status(400).send('Пожалуйста, отправьте текст и/или изображение.');
        }

        // Добавляем сообщение пользователя в историю чата
        if (textPrompt) {
            chatHistory.push({ role: 'user', type: 'text', content: textPrompt });
        }

        let content = [];
        let fastContent = [];
        for (const message of chatHistory) {
            const rolePrefix = message.role === 'model' ? "" : "[Максим:] ";
            if (message.type === 'text') {
                content.push(rolePrefix + message.content);
                fastContent.push(rolePrefix + message.content);
            } else if (message.type === 'image') {
                content.push({
                    fileData: {
                        fileUri: message.content.uri,
                        mimeType: message.content.mimeType,
                    },
                });
            }
        }

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        // Запускаем генерацию быстрого ответа немедленно
        const fastModelPromise = fastModel.generateContentStream(fastContent, fastGenerationConfig);

        let file = null;
        let uploadPromise = Promise.resolve(null)

        if (imagePath && mimeType) {
            uploadPromise = uploadToGemini(imagePath, mimeType);
        }

        let mainModelPromise = null; // Initialize as null initially

        let mainResponseText = '';
        let fastResponseText = '';
        let mainSentences = [];
        let fastSentences = [];
        let mainSentenceBuffer = '';
        let fastSentenceBuffer = '';
        let firstMainSentenceReceived = false;

        const processStream = async (stream, buffer, sentences, isMain) => {
            for await (const chunk of stream) {
                const chunkText = chunk.text() || '';
                buffer += chunkText;

                const newSentences = splitIntoSentences(buffer);
                if (newSentences.length > 1) {
                    sentences.push(...newSentences.slice(0, -1));
                    buffer = newSentences.slice(-1)[0];

                    if (isMain && !firstMainSentenceReceived && sentences.length > 0) {
                        firstMainSentenceReceived = true;
                    }
                }
                if (!isMain) {
                    res.write(`fast:${chunkText}`); // Помечаем быстрый ответ
                } else {
                    res.write(`main:${chunkText}`); // Помечаем основной ответ
                }
            }
            if (buffer) {
                sentences.push(buffer);
            }
        };


        // Process fast model immediately
        processStream((await fastModelPromise).stream, fastSentenceBuffer, fastSentences, false);

        // Start the upload and main model generation after fast response has begun
        const [uploadedFile] = await Promise.all([
            uploadPromise
        ]);

        if (uploadedFile) {
            chatHistory.push({
                role: 'user',
                type: 'image',
                content: { uri: uploadedFile.uri, mimeType: uploadedFile.mimeType },
            });
            content.push({
                fileData: {
                    fileUri: uploadedFile.uri,
                    mimeType: uploadedFile.mimeType,
                },
            });
        }

        if(content.length > 0){
            mainModelPromise = model.generateContentStream(content, generationConfig);
            await processStream((await mainModelPromise).stream, mainSentenceBuffer, mainSentences, true);
        }


        mainResponseText = mainSentences.join(' ');
        fastResponseText = fastSentences.join(' ');

        res.end();

        // Добавляем ответ ИИ в историю чата
        chatHistory.push({ role: 'model', type: 'text', content: mainResponseText });

        console.log("История чата:", chatHistory);

        // Удаляем временный файл
        if (imagePath) {
            await fs.unlink(imagePath);
        }

    } catch (error) {
        console.error('Ошибка при обработке запроса:', error);
        res.status(500).send('Ошибка при обработке изображения.');
    }
});

app.post('/search', async (req, res) => {
    const searchQuery = req.body.searchQuery;

    if (!searchQuery) {
        return res.status(400).send('Необходимо передать аргумент searchQuery');
    }

    // Устанавливаем заголовки для Server-Sent Events (SSE)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); // Отправляем заголовки немедленно

    console.log(`Получен запрос на поиск: ${searchQuery}`);

    // Функция для отправки данных клиенту в формате SSE
    const sendData = (event, data) => {
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Имитация асинхронных действий и отправки данных

    const result = await youtube.search(searchQuery);

    console.log(result.videos[0])
    const videoId = result.videos[0].id; // Пример videoId
    sendData('videoId', { videoId });
    const title = result.videos[0].title;
    sendData('title', { title });
    const creator = result.videos[0].channel.name;
    const creatorThumbnailLink = result.videos[0].channel.thumbnail;
    sendData('creator', { creator, creatorThumbnailLink });
    const date = result.videos[0].uploaded;
    if (date){
        sendData('date', { date });
    } else {
        sendData('date', { date: "Дата не указана" });
    }

    try {
        getSubtitles({
            videoID: result.videos[0].id, // youtube video id
            lang: detectLanguage(result.videos[0].description)
        }).then(async function (captions) {
            let captionString = "";
            for (const caption of captions) {
                captionString += caption.text + "\n"
            }
            console.log(captionString)
            const chatSession = basicModel.startChat({
                generationConfig,
                history: [],
            });
            let finalAnswer = "";

            try {
                const stream = await chatSession.sendMessageStream("Составьте небольшое и понятное summary на русском языке видео с названием \"" + title + "\" и описанием \"" + result.videos[0].description + "\" по его авто-сгенерированным субтитрам. Субтитры могут быть неточные или сами по себе не могут передать смысл видео поэтому додумывайте смысл некоторых моментах сами, но только так, чтобы не ошибиться. ОТВЕЧЕЙТЕ БЕЗ ГЛЮЦИНАЦИЙ, ЛИШНИХ КОММЕНТАРИЕВ, ДИЗИНФОРМАЦИИ И ДРУГИХ ВОЗМОЖНЫХ ОШИБОК. Ответ оформите КАК КРАСИВО ОФОРМЛЕННУЮ статью-summary по видео. Вот субтитры:\n" + captionString);
                for await (const chunk of stream.stream) {
                    process.stdout.write(chunk.text() || '');
                    finalAnswer += chunk.text() || '';
                    sendData('description', { description: finalAnswer });
                }
            } catch (err){
                console.log(err)
                sendData('description', { description: result.videos[0].description });
            }
        });
    } catch (err) {
        console.log(err)
        sendData('description', { description: result.videos[0].description });
    }

    // Обработка отключения клиента
    req.on('close', () => {
        console.log('Клиент отключился');
        // Здесь можно выполнить очистку ресурсов, если необходимо
    });
});

app.post('/search-music', async (req, res) => {
    const searchQuery = req.body.searchQuery;

    if (!searchQuery) {
        return res.status(400).send('Необходимо передать аргумент searchQuery');
    }

    // Устанавливаем заголовки для Server-Sent Events (SSE)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); // Отправляем заголовки немедленно

    console.log(`Получен запрос на поиск: ${searchQuery}`);

    // Функция для отправки данных клиенту в формате SSE
    const sendData = (event, data) => {
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Имитация асинхронных действий и отправки данных

    try {
        await api.init({ access_token: "y0_AgAAAABk1YqzAAG8XgAAAADh-3CLy3aY7UW2SUW_ul1H2CxhVinGTEc", uid: "aje5jrierc9oqnd49j4d" });
        const result = await api.searchTracks(searchQuery);
        console.log(result.tracks.results[0]);
        const currentTrackID = result.tracks.results[0].id;
        const getTrackResult = await api.getTrack(currentTrackID);
        console.log({ getTrackResult });

        const getTrackSupplementResult = await api.getTrackSupplement(
            currentTrackID
        );
        console.log({ getTrackSupplementResult });

        const getTrackDownloadInfoResult = await api.getTrackDownloadInfo(
            currentTrackID
        );
        console.log({ getTrackDownloadInfoResult });

        const mp3Tracks = getTrackDownloadInfoResult
            .filter((r) => r.codec === "mp3")
            .sort((a, b) => b.bitrateInKbps - a.bitrateInKbps);
        const hqMp3Track = mp3Tracks[0];
        console.log({ mp3Tracks, hqMp3Track });

        const getTrackDirectLinkResult = await api.getTrackDirectLink(
            hqMp3Track.downloadInfoUrl
        );
        console.log(getTrackDirectLinkResult);
        const id = getTrackDirectLinkResult; // Пример videoId
        sendData('id', { id });
        const title = result.tracks.results[0].title;
        sendData('title', { title });
        const creator = result.tracks.results[0].artists[0].name;
        sendData('creator', { creator });
        const date = result.tracks.results[0].albums[0].year.toString();
        if (date){
            sendData('date', { date });
        } else {
            sendData('date', { date: "Дата не указана" });
        }
        const description = getTrackSupplementResult.lyrics.fullLyrics;
        console.log(description)
        sendData('description', { description });
    } catch (e) {
        console.log(`api error ${e.message}`);
    }

    // Обработка отключения клиента
    req.on('close', () => {
        console.log('Клиент отключился');
        // Здесь можно выполнить очистку ресурсов, если необходимо
    });
});

app.post('/reset-chat', async (req, res) => {
    chatHistory = [];
    console.log("чат отчищен")
});

app.use('/temp-uploads', express.static(path.join(__dirname, 'temp-uploads')));

app.listen(port, () => {
    console.log(`Сервер запущен на порту ${port}`);
});
