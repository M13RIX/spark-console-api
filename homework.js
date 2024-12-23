const { ocrSpace } = require('ocr-space-api-wrapper');
const {search, ResultTypes} = require("google-sr");
const axios = require("axios");
const cheerio = require("cheerio");
const https = require("https");
const Groq = require("groq-sdk");
const read = require('node-readability');
const { convert } = require('html-to-text');
const {expression} = require("mathjs");
const nerdamer = require('nerdamer');
require('nerdamer/Calculus');
require('nerdamer/Algebra');
require('nerdamer/Solve');

const math = require('mathjs');

// Функция для решения уравнений и вычисления выражений
function solveExpression(expressionStr) {
    try {
        // Проверяем, есть ли в выражении знак равенства, чтобы решить уравнение
        if (expressionStr.includes('=')) {
            const solutions = nerdamer.solve(expressionStr, 'n').toString();
            return `Решение уравнения: n = ${solutions}`;
        } else {
            // Если это просто арифметическое выражение, вычисляем его
            const result = math.evaluate(expressionStr);
            return `Результат вычисления: ${result}`;
        }
    } catch (error) {
        return `Ошибка: ${error.message}`;
    }
}


const agent = new https.Agent({ rejectUnauthorized: false });

const groq = new Groq({
    apiKey: "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"
});

function findNonYouTubeLinkIndex(searchResults) {
    return searchResults.findIndex(result => {
        const url = result.link;
        // Проверяем, не является ли ссылка ссылкой на YouTube
        return !(url.includes('youtube.com') || url.includes('youtu.be'));
    });
}

async function HomeworkSearch(imageURL = 'https://firebasestorage.googleapis.com/v0/b/source-410210.appspot.com/o/images%2F1725539482635.jpg?alt=media&token=03458ae6-e1ff-4574-a062-e5ceccef92d3', socket) {

    socket.emit('next-homework-step', { title: 'Распознавание текста:', delay: 3000 });

    try {
        const imageRawText = await ocrSpace(imageURL, { language: "rus"});
        const imageText = imageRawText.ParsedResults[0].ParsedText;

        socket.emit('next-homework-token', 'Текст распознан: ' + imageText);

        console.log(imageText);

        socket.emit('next-homework-step', { title: 'Понимание проблемы:', delay: 3000 });

        let finalAnswer = [];

        const QuestionsChatCompletion = await groq.chat.completions.create({
            "messages": [
                {
                    "role": "system",
                    "content": "DO NOT HALLUCINATE! вы говорите ТОЛЬКО НА РУССКОМ ЯЗЫКЕ. Говорите ТОЛЬКО ОДИН ЗАПРОС"
                },
                {
                    "role": "user",
                    "content": "Какой один ОЧЕНЬ КОРОТКИЙ и ПОНЯТНЫЙ запрос в интернет нужно сделать, чтобы вам решить задачу максимально правильно: \"" + imageText + "\". Это могут быть вопросы по теме, например \"Как найти количество сторон многоугольника зная меру угла\", вопрос ПО ФОРМУЛАМ и т.д. и всё, что вам понадобиться. Если вы уже знаете ответ на вопрос то нет смысла его задавать. Перечислите этот вопрос заключая вопрос в [] скобки. ОТВЕТЬТЕ ТОЛЬКО ОДИН ЗАПРОС"
                },
            ],
            "model": "llama3-70b-8192",
            "temperature": 0.5,
            "max_tokens": 8192,
            "top_p": 1,
            "stream": true,
            "stop": null
        });

        let QuestionsAnswerString = "";

        for await (const chunk of QuestionsChatCompletion) {
            process.stdout.write(chunk.choices[0]?.delta?.content || '');

            QuestionsAnswerString += chunk.choices[0]?.delta?.content;

            socket.emit('next-homework-token', chunk.choices[0]?.delta?.content);
        }

        for (let part of QuestionsAnswerString.split("["))
        {
            if (QuestionsAnswerString.split("[").indexOf(part) !== 0){
                finalAnswer.push({
                    question: "математика " + part,
                    answer: ""
                });
            }
        }

        socket.emit('next-homework-step', { title: 'Поиск информации в интернете:', delay: 3000 });

        for await (const answerPart of finalAnswer)
        {
            console.log(answerPart.question)

            const searchResults = await search({
                query: answerPart.question,
                safeMode: false,
                filterResults: [ResultTypes.SearchResult]
            });

            if (searchResults.length === 0) {
                console.log('No results found.');
                //socket.emit('search_answer', 'No results found.');
                break;
            }

            console.log(searchResults)

            const url = searchResults[findNonYouTubeLinkIndex(searchResults)].link;

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
                            "content": "КАКОЙ ОТВЕТ НА ВОПРОС \"" + answerPart.question + "\" в ДАННОМ ТЕКСТЕ ИНФОРМАЦИИ. используйте информацию (код сайта с информацией). ОТВЕТЬТЕ ОЧЕНЬ КРАТКО И ПОНЯТНО, В ОДНО КОРОТКОЕ ПРЕДЛОЖЕНИЕ. Вот информация:\n" + allExcerpts
                        },
                    ],
                    "model": "llama3-8b-8192",
                    "temperature": 0.5,
                    "max_tokens": 8192,
                    "top_p": 1,
                    "stream": true,
                    "stop": null
                });


                for await (const chunk of chatCompletion) {
                    process.stdout.write(chunk.choices[0]?.delta?.content || '');

                    finalAnswer[finalAnswer.indexOf(answerPart)].answer += chunk.choices[0]?.delta?.content;

                    socket.emit('next-homework-token', chunk.choices[0]?.delta?.content);
                }
        }

        let questionString = ""
        for (const answerPart of finalAnswer){
            questionString += "\"" + answerPart.question + "\" - ответ - \"" + answerPart.answer + "\"\n"
        }

        console.log(questionString);

        socket.emit('next-homework-step', { title: 'Решение математических примеров:', delay: 3000 });

        // Отправляем текст для генерации ответа
        const chatCompletion = await groq.chat.completions.create({
            "messages": [
                {
                    "role": "system",
                    "content": "JSON. Вы решаете математические задачи. В поле math вы пишите математические выражения, но НИГДЕ НЕ ПИШИТЕ ОТВЕТ, так как затем программа сама решит эти выражения. В поле math в качестве ЧИСЕЛ могут быть ТОЛЬКО INTEGER БЕЗ ДОПОЛНИТЕЛЬНЫХ ЗАКОВ (по типу градусов) и в качестве переменных ТОЛЬКО АГЛИЙСКИЕ БУКВЫ, знаки умножения ВСЕГДА СТАВИТЬ, если в уравнении есть 3x например, то это будет 3 * x. DO NOT HALLUCINATE! ПИШИТЕ ПРИМЕРЫ ПРАИЛЬНО, БЕЗ ОШИБОК. Пример вашего ответа:\n{\n\"actions\": [\n{\n\"text\": \"Для нахождения этой величины на нужно решить уравнение:\",\n\"math\": \"(12*x) + (14*2) = 100\"\n},\n{\n\"text\": \"Теперь найдём огурцы\",\n\"math\": \"18 + 24 * 42\"\n}\n]\n}"
                },
                {
                    "role": "user",
                    "content": "Решишь пожалуйста задачу \"" + imageText + "\". Вот ФОРМУЛЫ и ИНФОРМАЦИЯ, которую вы ДОЛЖНЫ ИСПОЛЬЗОВАТЬ:\n" + questionString
                },
            ],
            "model": "llama3-70b-8192",
            "temperature": 0.5,
            "max_tokens": 1024,
            "top_p": 0.5,
            "stream": false,
            "response_format": {
                "type": "json_object"
            },
            "stop": null
        });

        let mathExpressions = [];
        let mathExpressionsString = chatCompletion.choices[0].message.content;

        socket.emit('next-homework-token', mathExpressionsString);

        for (let expression of JSON.parse(mathExpressionsString).actions){
            mathExpressions.push({
                expression: expression.math,
                answer: solveExpression(expression.math)
            });
            console.log("ВЫРАЖЕНИЕ: " + expression.math + " Ответ: " + solveExpression(expression.math))
        }

        let mathExpressionsAnswerString = "";
        for (const answerPart of mathExpressions){
            mathExpressionsAnswerString += "\"" + answerPart.expression + "\" - ответ - \"" + answerPart.answer + "\"\n"
        }

        socket.emit('next-homework-step', { title: 'Итоговое решение:', delay: 3000 });

        const FinalChatCompletion = await groq.chat.completions.create({
            "messages": [
                {
                    "role": "system",
                    "content": "DO NOT HALLUCINATE! И ПИШИТЕ ВСЕ ТОЧНО. вы говорите ТОЛЬКО НА РУССКОМ ЯЗЫКЕ"
                },
                {
                    "role": "user",
                    "content": "Выпишите все математические примеры или уравнения, которые нужны чтобы решить задачу: \"" + imageText + "\". НЕ РЕШАЙТЕ никакие математические ПРИМЕРЫ или УРАВНЕНИЯ так как затем программа сама решит эти выражения. Вот информация которая может вам помочь:\n" + questionString
                },
                {
                    "role": "assistant",
                    "content": mathExpressionsString
                },
                {
                    "role": "user",
                    "content": "Хорошо, теперь РЕШИТЕ ДАННОЕ ЗАДАНИЕ ИСПОЛЬЗУЯ ОТВЕТЫ на ВАШИ математические примеры. НАПИШИТЕ БЕЗ ОШИБОК. Вот ОТВЕТЫ НА ПРИМЕРЫ БЕЗ ОШИБОК, ИСПОЛЬЗУЙТЕ ИХ:\n" + mathExpressionsAnswerString
                },
            ],
            "model": "llama3-70b-8192",
            "temperature": 0.7,
            "max_tokens": 1024,
            "top_p": 1,
            "stream": true,
            "stop": null
        });

        let FinalAnswer = "";
        for await (const chunk of FinalChatCompletion) {
            process.stdout.write(chunk.choices[0]?.delta?.content || '');

            FinalAnswer += chunk.choices[0]?.delta?.content;

            socket.emit('next-homework-token', chunk.choices[0]?.delta?.content);
        }

    } catch (error) {
        console.error(error);
    }
}

module.exports = {
    HomeworkSearch
};
