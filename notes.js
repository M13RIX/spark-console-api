const {search, ResultTypes} = require("google-sr");
const axios = require("axios");
const cheerio = require("cheerio");
const levenshtein = require("fast-levenshtein");
const https = require("https");
const Groq = require('groq-sdk');
const express = require('express');

const groq = new Groq({
    apiKey: "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"
});


async function aiWrite(text = "", prompt = "", socket){
    // Отправляем текст для генерации ответа
    const chatCompletion = await groq.chat.completions.create({
        "messages": [
            {
                "role": "system",
                "content": "Вы форматируете и преобразовываете текст html. Вы делаете все действия и команды с высочайшей точностью и правильностью. Вам даётся на вход код html этого текста и команда, и вы должны ответить html преобразовав этот текст как сказано. ОТВЕЧАЙТЕ ТОЛЬКО КОДОМ HTML."
            },
            {
                "role": "user",
                "content": prompt + " Отвечайте ничего кроме изменённого html кода. Имена собственные (названия) НЕ МЕНЯЙТЕ, текст пишите СТРОГО ПО ПРАВИЛАМ РУССКОГО ЯЗЫКА, БЕЗ ОШИБОК. Вот изначальный текст: \n" + text
            },
        ],
        "model": "gemma2-9b-it",
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
    }

    socket.emit('notes_answer', finalAnswer);
}

module.exports = {
    aiWrite
};
