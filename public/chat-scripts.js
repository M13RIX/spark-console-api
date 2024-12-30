const serverAddress = 'http://localhost:1000/';
const socket = io(serverAddress, { transports: ['websocket'], upgrade: false });

let isAnswerReady = true;
let lastAnswer = "";
let currentAnimatedElements = [];
let lastAnswerHtml = "";
let lastSmartAnswer = "";
let lastNotification;
let userData;
let timerId;
let timeLeft = 300;
let isEmotionsUpdated = true;
let lastSentence = "";
let isSearching = false;
let enableTTS = false;
let isAiTalking = false;
let editableMessage;
let editableMessageText = "";
let detailedAnswersElements;
let currentPlaygroundChatIndex = 0;

let aiMessage;
let aiPlaygroundMessage;

document.getElementById('svg-button').addEventListener('click', sendMessage);
document.getElementById('playground-send-button').addEventListener('click', sendPlaygroundMessage);
const textarea = document.querySelector('.playground-input-field');

textarea.addEventListener('input', function () {
    this.style.height = 'auto'; // Сбрасываем высоту
    this.style.height = `${this.scrollHeight}px`; // Устанавливаем высоту на основе содержимого
});

function subtractStrings(str1, str2) {
    return str1.replace(new RegExp(str2, 'g'), '');
}

socket.on('ai_answer_chunk', async (msg) => {
    lastAnswer = removeTextInAsterisks(msg).cleanedText;
    addAiContent(aiMessage, formatText(msg));
    lastAnswerHtml = formatText(msg);
    let parts = subtractStrings(lastAnswer, lastSentence).split(/[.;:!?…\s]+/);
    parts.pop();
    const message = parts.join(" ");

    if (message) {
        console.log("Current sentence: " + lastSentence);
        if (!isAiTalking) {
            console.log(message);
            await tts(message);
            lastSentence = message;
        }
    }
});

socket.on('ai_playground_answer_chunk', (msg) => {
    lastAnswer = removeTextInAsterisks(msg).cleanedText;
    addAiContent(aiPlaygroundMessage, formatText(msg));
    lastAnswerHtml = formatText(msg);
    Prism.highlightAll();
});

socket.on('smart_answer_chunk', (msg) => {
    lastSmartAnswer = msg;
    const shortAnswer = msg.short;
    const detailedAnswers = msg.detailed; // подробные ответы по категориям
    document.getElementById('short-answer-text').innerText = shortAnswer.text;
    document.getElementById('short-answer-img').src = shortAnswer.imageUrl;

    // Обновление подробных ответов
    const detailedContainer = document.querySelector('.detailed-answers');
    detailedContainer.innerHTML = ''; // Очистить предыдущие подробные ответы
    detailedAnswers.forEach((category, index) => {
        const categoryDiv = document.createElement('div');
        categoryDiv.classList.add('category-answer');

        // Создание баннера категории
        const categoryBanner = document.createElement('div');
        categoryBanner.classList.add('category-banner');
        categoryBanner.style.backgroundColor = getRandomColorHex();
        categoryBanner.innerHTML = `<span>${category.title}</span>`;

        // Создание контента категории
        const categoryContent = document.createElement('div');
        categoryContent.classList.add('category-content');
        categoryContent.innerHTML = `<p>${category.content}</p>`;
        categoryContent.id = `category-content-${index}`; // Уникальный id

        categoryDiv.appendChild(categoryBanner);
        categoryDiv.appendChild(categoryContent);
        detailedContainer.appendChild(categoryDiv);
    });

    //Prism.highlightAll();
});

socket.on('smart_answer_detailed_answer_chunk', (msg) => {
    const banner = document.getElementById('category-content-' + msg.index.toString())
    banner.innerHTML = formatText(msg.text)
});

socket.on('smart_answer_links', (msg) => {
    // Обновление ссылок на сайты
    const siteLinksContainer = document.getElementById('site-links');
    siteLinksContainer.innerHTML = ''; // Очистить старые ссылки

    msg.forEach((site) => {
        const siteDiv = document.createElement('div');
        siteDiv.classList.add('site-link');

        const siteName = document.createElement('div');
        siteName.classList.add('site-name');
        siteName.innerText = site.title;
        siteName.addEventListener('click', () => {
            window.open(site.links, '_blank');
        });

        const siteDescription = document.createElement('div');
        siteDescription.classList.add('site-description');
        siteDescription.innerText = site.snippet;

        const chooseButton = document.createElement('button');
        chooseButton.classList.add('choose-button');
        chooseButton.innerText = 'Выбрать';
        chooseButton.addEventListener('click', () => {
            // Открытие и обработка текста с сайта
            fetch(site.links)
                .then(response => response.text())
                .then(content => {
                    const aiGeneratedText = `Этот сайт предлагает: ${content.slice(0, 500)}...`; // Краткое содержание
                    const newAiMessage = addAiMessage();
                    addAiContent(newAiMessage, aiGeneratedText);
                });
        });

        siteDiv.appendChild(siteName);
        siteDiv.appendChild(siteDescription);
        siteDiv.appendChild(chooseButton);
        siteLinksContainer.appendChild(siteDiv);
    });
});

socket.on('user-banned', (msg) => {
    userData.banned = true;
    window.location.href = '/banned';
});

socket.on('notification', (msg) => {
    const { icon, text } = msg;
    showNotification(text, icon);
});

socket.on('ai_answer', async (msg) => {
    currentAnimatedElements = [];
    aiMessage = addAiMessage();
});

socket.on('ai_playground_answer', (msg) => {
    currentAnimatedElements = [];
    aiPlaygroundMessage = addPlaygroundAiMessage();
});

socket.on('ai_error', (msg) => {
    currentAnimatedElements = [];
    aiMessage = addErrorMessage();
    addAiContent(aiMessage, formatText("**Неизвестная ошибка. Попробуйте переключить модель ИИ в \"Настройки\", \"Модель ИИ\". Код ошибки:**\n" + msg));
});

socket.on('ai_answer-ready', async (msg) => {
    isAnswerReady = true;
    console.log("Answer is ready for TTS");
    socket.emit("get-chat");
    waitForVariableToBeFalse('isAiTalking', async () => {
        await tts(subtractStrings(lastAnswer, lastSentence));
        startTimer();
    });
});

socket.on('rename-current-session', async (msg) => {
    userData.playgroundChat[currentPlaygroundChatIndex].name = msg;
    populatePlaygroundButtons(userData.playgroundChat, currentPlaygroundChatIndex);
    localStorage.setItem('userData', JSON.stringify(userData));
    socket.emit('saveSettings', userData);
});

socket.on('ai_playground_answer-ready', async (msg) => {
    isAnswerReady = true;
    currentParts = [];
    addEditButtonToLatestMessage(userData.playgroundChat[currentPlaygroundChatIndex].chat.length - 1);
    localStorage.setItem('userData', JSON.stringify(userData));
    socket.emit('saveSettings', userData);
    console.log("Answer is ready for TTS");
    socket.emit("get-playground-chat");
});

socket.on('ai_emotions-updated', async (msg) => {
    isEmotionsUpdated = true;
    currentParts = [];
    console.log("Answer is ready for TTS");
    socket.emit("get-chat");
});

socket.on('smart_answer_ready', async (msg) => {
    if (!isAnswerReady) {
        convertLastAiMessageToHiddenHtml(lastSmartAnswer);
        if (lastNotification) {
            lastNotification.classList.remove('visible');
            lastNotification.classList.add('hidden');
        }
    }
    isSearching = false;
    document.getElementById('smart-search-result').classList.remove('loading');
});

socket.on('edited_answer_chunk', async (msg) => {
    editableMessage.innerHTML = formatText(msg);
    Prism.highlightAll();
});

socket.on('edited_answer_chunk-ready', async (msg) => {
    userData.playgroundChat[currentPlaygroundChatIndex].chat = updateChatMessage(userData.playgroundChat[currentPlaygroundChatIndex].chat, editableMessageText, msg.editedText)
    localStorage.setItem('userData', JSON.stringify(userData));
    socket.emit('saveSettings', userData);
    addEditButtonToLatestMessage(userData.playgroundChat[currentPlaygroundChatIndex].chat.length - 1);
    console.log("Answer is ready for TTS");
    editableMessage = null;
    document.getElementById("playground-user-input").placeholder = "Ваше сообщение здесь..."
});

function updateChatMessage(chatArray, originalText, updatedText) {
    // Создаем копию массива чата, чтобы не изменять исходные данные
    const updatedChat = JSON.parse(JSON.stringify(chatArray));

    // Проходим по каждому элементу массива
    updatedChat.forEach((message) => {
        // Ищем в частях текста текст, который соответствует originalText
        if (
            message.parts &&
            message.parts.some((part) => part.text === originalText)
        ) {
            // Заменяем текст на updatedText
            message.parts = message.parts.map((part) =>
                part.text === originalText ? { text: updatedText } : part
            );
        }
    });

    console.log(updatedChat)

    return updatedChat;
}

socket.on('load-messages', (msg) => {
    userData.chat = msg;
    populateChatFromList(msg);
    localStorage.setItem('userData', JSON.stringify(userData));
    socket.emit('saveSettings', userData);
});

socket.on('load-playground-messages', (msg) => {
    userData.playgroundChat[currentPlaygroundChatIndex].chat = msg;
    populatePlaygroundChatFromList(msg);
    localStorage.setItem('userData', JSON.stringify(userData));
    socket.emit('saveSettings', userData);
});

socket.on('chat-data', (msg) => {
    userData.chat = msg;
    console.log("Чат: " + userData.chat + "Конец чата");
    localStorage.setItem('userData', JSON.stringify(userData));
    socket.emit('saveSettings', userData);
});

socket.on('playground-chat-data', (msg) => {
    console.log(msg)
    userData.playgroundChat[currentPlaygroundChatIndex].chat = msg;
    localStorage.setItem('userData', JSON.stringify(userData));
    socket.emit('saveSettings', userData);
});

socket.on('emotional-parameters', (msg) => {
    const parameters = JSON.parse(msg);
    document.getElementById('joy').value = parameters.joy;
    document.getElementById('joy-value').textContent = parameters.joy + "%";
    document.getElementById('anger').value = parameters.anger;
    document.getElementById('anger-value').textContent = parameters.anger + "%";
    document.getElementById('sadness').value = parameters.sadness;
    document.getElementById('sadness-value').textContent = parameters.sadness + "%";
    parameters.emotions.forEach(addEmotion);
    setPsychologicalDescription(parameters.state);
});

socket.on('saveRelationshipState', (msg) => {
    userData.relationshipState = msg;
    localStorage.setItem('userData', JSON.stringify(userData));
    socket.emit('saveSettings', userData);
});

socket.on('settings-saved', (msg) => {
    setLoadingState(document.getElementById('settings-form'), false);
});

document.getElementById("user-input").addEventListener("keypress", function(e) {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

document.getElementById('add-chat-button').addEventListener('click', addPlaygroundChat);

function addPlaygroundChat(){
    userData.playgroundChat.push({
        name: "Новое обсуждение",
        chat: []
    })
    currentPlaygroundChatIndex = userData.playgroundChat.length - 1;
    populatePlaygroundChatFromList(userData.playgroundChat[currentPlaygroundChatIndex].chat);
    populatePlaygroundButtons(userData.playgroundChat, userData.playgroundChat.length - 1);
    const chatWindow = document.getElementById("playground-button-panel");
    chatWindow.scrollLeft = chatWindow.scrollWidth;
}

function deletePlaygroundChat(){
    userData.playgroundChat.splice(currentPlaygroundChatIndex, 1)
    currentPlaygroundChatIndex = userData.playgroundChat.length - 1;
    populatePlaygroundChatFromList(userData.playgroundChat[currentPlaygroundChatIndex].chat);
    populatePlaygroundButtons(userData.playgroundChat, userData.playgroundChat.length - 1);
    localStorage.setItem('userData', JSON.stringify(userData));
    socket.emit('saveSettings', userData);
}

function addCopyButtonToCodeBlocks() {
    document.querySelectorAll('pre code').forEach((codeBlock) => {
        const button = document.createElement('button');
        button.className = 'copy-code-button';
        button.textContent = 'Copy';
        button.addEventListener('click', () => {
            navigator.clipboard.writeText(codeBlock.textContent).then(() => {
                button.textContent = 'Copied!';
                setTimeout(() => button.textContent = 'Copy', 2000);
            });
        });
        codeBlock.parentNode.insertBefore(button, codeBlock);
    });
}

function waitForVariableToBeFalse(variableName, callback, checkInterval = 100) {
    const intervalId = setInterval(() => {
        if (isAiTalking === false) {
            clearInterval(intervalId);
            callback();
        }
    }, checkInterval);
}

async function tts(text) {
    isAiTalking = true;
    if (!text.trim()) {
        alert("Введите текст для озвучивания!");
        isAiTalking = false;
        return;
    }

    try {
        const response = await fetch(serverAddress + 'stream-audio', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text })
        });

        if (!response.ok) {
            isAiTalking = false;
            throw new Error('Ошибка генерации аудио');
        }

        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        try {
            await audio.play();
            audio.addEventListener('timeupdate', () => {
                const remainingTime = audio.duration - audio.currentTime;
                if (remainingTime <= 4 && !audio.actionExecuted) {
                    isAiTalking = false;
                    audio.actionExecuted = true;
                }
            });

            audio.addEventListener('ended', () => {
                URL.revokeObjectURL(audioUrl);
            });
        } catch (error) {
            isAiTalking = false;
        }
    } catch (error) {
        console.error(error);
        isAiTalking = false;
    }
}

function setLoadingState(button, isLoading) {
    if (isLoading) {
        button.classList.add('loading');
        button.disabled = true;
    } else {
        button.classList.remove('loading');
        button.disabled = false;
    }
}

function requestSynthesis(text = "") {
    const sentence = text;
    const gender = 0;
    socket.emit('synthesizeSpeech', { sentence, gender });
}

socket.on('audioData', (data) => {
    const audioData = atob(data.audio);
    const audioBuffer = new Uint8Array(audioData.length);
    for (let i = 0; i < audioData.length; i++) {
        audioBuffer[i] = audioData.charCodeAt(i);
    }

    const context = new (window.AudioContext || window.webkitAudioContext)();
    context.decodeAudioData(audioBuffer.buffer, (buffer) => {
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(context.destination);
        source.start(0);
    });
});

function sendMessage() {
    const userInput = document.getElementById("user-input");
    const messageText = userInput.value.trim();

    if (messageText === "" || !isAnswerReady || !isEmotionsUpdated) return;

    if (messageText === "/reset_memory") {
        userData.chat = [];
        localStorage.setItem('userData', JSON.stringify(userData));
        socket.emit('saveSettings', userData);
        location.reload();
        return;
    }

    if (messageText === "/error") {
        currentAnimatedElements = [];
        aiMessage = addErrorMessage();
        addAiContent(aiMessage, formatText("**Неизвестная ошибка. Попробуйте переключить модель ИИ в \"Настройки\", \"Модель ИИ\". Код ошибки:**\n" + "testing..."));
        return;
    }

    isAnswerReady = false;

    const userMessage = document.createElement("div");
    userMessage.classList.add("message", "user-message");
    userMessage.innerText = messageText;

    const chatWindow = document.getElementById("chat-window");
    chatWindow.appendChild(userMessage);
    userInput.value = "";

    chatWindow.scrollTop = chatWindow.scrollHeight;

    socket.emit('question', messageText);
}

function sendPlaygroundMessage() {
    const userInput = document.getElementById("playground-user-input");
    const messageText = userInput.value.trim();

    if (messageText === "/reset_memory") {
        userData.playgroundChat[currentPlaygroundChatIndex].chat = [];
        localStorage.setItem('userData', JSON.stringify(userData));
        socket.emit('saveSettings', userData);
        location.reload();
        return;
    }

    if (editableMessage){
        socket.emit('edit-playground-response', {
            message: editableMessageText,
            remark: messageText,
            chat: userData.playgroundChat[currentPlaygroundChatIndex].chat
        });
        userInput.value = "";
        return;
    }

    const userMessage = document.createElement("div");
    userMessage.classList.add("message", "user-message");
    userMessage.innerText = messageText;

    const chatWindow = document.getElementById("playground-chat-window");
    chatWindow.appendChild(userMessage);
    userInput.value = "";
    this.style.height = 'auto'; // Сбрасываем высоту

    chatWindow.scrollTop = chatWindow.scrollHeight;

    socket.emit('playground-question', {
        message: messageText,
        chat: userData.playgroundChat[currentPlaygroundChatIndex].chat
    });
    userData.playgroundChat[currentPlaygroundChatIndex].chat.push({
        role: "user",
        parts: [{
            text: messageText
        }]
    })
}

function addAiMessage() {
    if (aiMessage) aiMessage.style.marginBottom = "1px";

    const chatWindow = document.querySelector('.chat-window');
    const messageContainer = document.createElement('div');
    messageContainer.classList.add('message', 'ai-message', 'loading');

    chatWindow.appendChild(messageContainer);
    messageContainer.style.marginBottom = "170px";
    chatWindow.scrollTop = chatWindow.scrollHeight;

    return messageContainer;
}

function addPlaygroundAiMessage() {
    if (aiPlaygroundMessage) aiPlaygroundMessage.style.marginBottom = "1px";

    const chatWindow = document.getElementById("playground-chat-window");
    const messageContainer = document.createElement('div');
    messageContainer.classList.add('message', 'playground-message', 'loading');

    chatWindow.appendChild(messageContainer);
    messageContainer.style.marginBottom = "170px";
    chatWindow.scrollTop = chatWindow.scrollHeight;

    return messageContainer;
}

function convertLastAiMessageToHiddenHtml(hiddenHtml) {
    const chatWindow = document.getElementById("chat-window");
    const aiMessages = chatWindow.getElementsByClassName('ai-message');
    if (aiMessages.length === 0) return;

    const lastAiMessage = aiMessages[aiMessages.length - 1];
    if (lastAiMessage.querySelector('.hidden-html')) {
        console.warn("Это сообщение уже содержит скрытый HTML.");
        return;
    }

    const hiddenHtmlElement = document.createElement('span');
    hiddenHtmlElement.classList.add('hidden-html');
    hiddenHtmlElement.style.display = 'none';
    hiddenHtmlElement.innerHTML = hiddenHtml;
    lastAiMessage.appendChild(hiddenHtmlElement);

    const button = document.createElement('button');
    button.classList.add('svg-button', 'ai-button');
    button.innerHTML = `<img src="edit.svg" alt="Show hidden text" />`;
    lastAiMessage.appendChild(button);

    button.addEventListener('click', () => {
        expandNotification(hiddenHtml, "smart_search.svg");
    });

    console.log("Последнее сообщение ИИ обновлено скрытым HTML.");
}

function addEditButtonToLatestMessage(messageIndex) {
    const chatWindow = document.getElementById("playground-chat-window");
    const aiMessages = chatWindow.getElementsByClassName('playground-message');
    if (aiMessages.length === 0) return;

    const lastAiMessage = aiMessages[aiMessages.length - 1];

    const button = document.createElement('button');
    button.classList.add('svg-button', 'ai-button');
    button.innerHTML = `<img src="edit_note.svg" alt="Edit response" />`;
    // Сохраняем текущее значение длины
    lastAiMessage.appendChild(button);

    button.addEventListener('click', () => {
        editMessage(lastAiMessage, messageIndex);
    });

    console.log("Последнее сообщение ИИ обновлено с кнопкой редактирования");
}

function editMessage(message, textIndex = 0){
    editableMessage = message;
    editableMessageText = userData.playgroundChat[currentPlaygroundChatIndex].chat[textIndex].parts[0].text;
    console.log(textIndex)
    console.log(editableMessageText)
    document.getElementById("playground-user-input").placeholder = "Опишите ваше изменение...";
}

function addErrorMessage() {
    if (aiMessage) aiMessage.style.marginBottom = "1px";

    const chatWindow = document.querySelector('.chat-window');
    const messageContainer = document.createElement('div');
    messageContainer.classList.add('message', 'error-message');

    chatWindow.appendChild(messageContainer);
    messageContainer.style.marginBottom = "170px";
    chatWindow.scrollTop = chatWindow.scrollHeight;

    return messageContainer;
}

function addAiContent(messageContainer, htmlContent) {
    if (messageContainer.classList.contains('loading')) {
        messageContainer.classList.remove('loading');
    }

    messageContainer.innerHTML = htmlContent;
    const chatWindow = document.querySelector('.chat-window');
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

function populateChatFromList(messages) {
    const chatWindow = document.getElementById("chat-window");

    messages.forEach((message, i) => {
        if (message.role === "user") {
            const userMessage = document.createElement("div");
            userMessage.classList.add("message", "user-message");
            userMessage.innerText = message.content;
            chatWindow.appendChild(userMessage);
        } else if (message.role === "assistant") {
            const aiMessage = addAiMessage();
            addAiContent(aiMessage, formatText(message.content));
            aiMessage.style.marginBottom = "1px";

            if (i + 1 < messages.length && messages[i + 1].role === "system" && messages[i + 1].content.startsWith("Ответ из поиска в интернете:\n")) {
                const hiddenHtmlContent = messages[i + 1].content.replace("Ответ из поиска в интернете:\n", "");
                const formattedHiddenHtml = formatText(hiddenHtmlContent);
                convertLastAiMessageToHiddenHtml(formattedHiddenHtml);
                i++;
            }

            if (i === messages.length - 1) {
                aiMessage.style.marginBottom = "170px";
            }
        }
        chatWindow.scrollTop = chatWindow.scrollHeight;
    });
}

function populatePlaygroundChatFromList(messages) {
    if (!messages) return;
    const chatWindow = document.getElementById("playground-chat-window");
    chatWindow.innerHTML = "";

    messages.forEach((message, i) => {
        if (message.role === "user") {
            const userMessage = document.createElement("div");
            userMessage.classList.add("message", "user-message");
            userMessage.innerText = message.parts[0].text;
            chatWindow.appendChild(userMessage);
        } else if (message.role === "model") {
            const aiMessage = addPlaygroundAiMessage();
            addAiContent(aiMessage, formatText(message.parts[0].text));
            aiMessage.style.marginBottom = "1px";

            if (i === messages.length - 1) {
                aiMessage.style.marginBottom = "170px";
            }
            addEditButtonToLatestMessage(i);
        }
        chatWindow.scrollTop = chatWindow.scrollHeight;
    });
    Prism.highlightAll();
}

function populatePlaygroundButtons(messages, selectedIndex = 0) {
    console.log("Чаты: " + messages)
    if (!messages) return;
    const chatWindow = document.getElementById("playground-button-panel");
    chatWindow.innerHTML = "";

    messages.forEach((message, i) => {
        const button = document.createElement("button");
        button.classList.add("chat-button");
        button.innerText = message.name;
        chatWindow.appendChild(button);
    });

    const tabs = document.querySelectorAll('.chat-button');

    tabs.forEach((button, i) => {
        button.addEventListener('click', function () {
            tabs.forEach(t => t.classList.remove('active'));

            button.classList.add('active');

            currentPlaygroundChatIndex = i;
            userData.currentPlaygroundChatIndex = currentPlaygroundChatIndex;
            localStorage.setItem('userData', JSON.stringify(userData));
            populatePlaygroundChatFromList(userData.playgroundChat[i].chat)
        });
    });
    tabs[currentPlaygroundChatIndex].classList.add('active');
}

function formatText(text) {
    // Удаляем текст внутри звездочек (если removeTextInAsterisks доступна)
    text = removeTextInAsterisks(text).cleanedText;

    // Разбиваем текст на блоки, разделяя на строки кода и обычный текст
    const blocks = text.split(/(```[\s\S]*?```)/g);

    return blocks.map(block => {
        if (block.startsWith('```') && block.endsWith('```')) {
            // Определяем язык из блока кода
            const match = block.match(/```(\w+)/);
            const language = match ? match[1] : 'plaintext';

            // Экранируем HTML в содержимом блока кода
            const escapeHTML = str => str.replace(/[&<>"']/g, tag => (
                { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[tag] || tag
            ));
            const codeContent = escapeHTML(block.replace(/```(\w+)?/, '').replace(/```$/, ''));

            // Подсвечиваем код с помощью Prism
            const highlightedCode = Prism.highlight(codeContent, Prism.languages[language] || Prism.languages.plaintext, language);

            // Возвращаем форматированный блок кода
            return `<pre><code class="language-${language}">${highlightedCode}</code></pre>`;
        } else {
            // Форматируем обычный текст
            block = block
                .replace(/^##\s*(.*)$/gm, '<h2>$1</h2>') // Заголовки уровня 2
                .replace(/\*\*(.*?)\*\*/g, '<strong><span class="bold">$1</span></strong>') // Жирный текст
                .replace(/_(.*?)_/g, '<em>$1</em>') // Курсив
                .replace(/(?<!\*)\*(?!\*)/g, '<span class="bold">  •</span>') // Маркеры
                .replace(/\n/g, '<br>'); // Переносы строк

            return block;
        }
    }).join('');
}


function removeTextInAsterisks(input) {
    let text = input.replace(/�/g, '');
    return { cleanedText: text };
}

function showNotification(message, iconSrc) {
    const notification = document.getElementById('notification');
    const notificationText = notification.querySelector('.notification-text');
    const notificationIcon = notification.querySelector('.notification-icon');

    notificationText.textContent = message;
    if (iconSrc) {
        notificationIcon.src = iconSrc;
    }

    notification.classList.remove('hidden');
    notification.classList.add('visible');

    notification.addEventListener('click', () => expandNotification(message, iconSrc));
    lastNotification = notification;
}

function expandNotification(message, iconSrc) {
    const expandedNotification = document.getElementById('expanded-notification');
    const blurBackground = document.getElementById('blur-background');
    const expandedText = expandedNotification.querySelector('.expanded-text');
    const expandedIcon = expandedNotification.querySelector('.expanded-icon');

    expandedText.innerHTML = `${message}`;
    expandedIcon.src = iconSrc;

    expandedNotification.classList.remove('hidden');
    expandedNotification.classList.add('visible');
    blurBackground.classList.remove('hidden');
    blurBackground.classList.add('visible');

    document.querySelector('.close-btn').addEventListener('click', closeExpandedNotification);
}

function closeExpandedNotification() {
    const expandedNotification = document.getElementById('expanded-notification');
    const blurBackground = document.getElementById('blur-background');

    expandedNotification.classList.remove('visible');
    expandedNotification.classList.add('hidden');
    blurBackground.classList.remove('visible');
    blurBackground.classList.add('hidden');
}

function updateExpandedContent(htmlContent) {
    const expandedText = document.querySelector('.expanded-text');
    expandedText.innerHTML = htmlContent;
}

function startTimer() {
    clearInterval(timerId);
    timeLeft = 300;

    timerId = setInterval(() => {
        timeLeft--;
        console.log(timeLeft);

        if (timeLeft <= 0) {
            clearInterval(timerId);
            socket.emit("update-emotions");
            isEmotionsUpdated = false;
        }
    }, 1000);
}

document.addEventListener('DOMContentLoaded', function () {
    const tabs = document.querySelectorAll('.tab-button');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', function () {
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));
            contents.forEach(c => c.classList.add('hidden'));

            tab.classList.add('active');
            const contentId = tab.id.replace('tab-', '') + '-container';
            document.getElementById(contentId).classList.add('active');
            document.getElementById(contentId).classList.remove('hidden');
        });
    });
});

document.getElementById('verify-api-key').addEventListener('click', function() {
    const apiKey = document.getElementById('groq-api-key').value.trim();
    if (apiKey) {
        socket.emit('verify-api-key', { apiKey });
    }
});

document.getElementById('settings-form').addEventListener('submit', function(event) {
    event.preventDefault();

    userData.username = document.getElementById('username').value;
    userData.realName = document.getElementById('real-name').value;
    userData.gender = document.getElementById('gender').value;
    userData.bio = document.getElementById('about').value;
    userData.birthdate = document.getElementById('birth-date').value;
    userData.apiKey = document.getElementById('groq-api-key').value;
    userData.modelName = document.getElementById('model').value;

    setLoadingState(document.getElementById('settings-form'), true);

    localStorage.setItem('userData', JSON.stringify(userData));

    socket.emit('saveSettings', userData);
});

document.getElementById('smart-search-button').addEventListener('click', () => {
    handleSmartSearch();
});

document.getElementById('smart-search-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSmartSearch();
    }
});

let currentIndex = 0;
const cards = document.querySelectorAll('.card');
const totalCards = cards.length;

function updateCards() {
    cards.forEach((card, index) => {
        card.classList.remove('inactive-left', 'active', 'inactive-right');
        if (index === currentIndex) {
            card.classList.add('active');
        } else if (index === (currentIndex + 1) % totalCards) {
            card.classList.add('inactive-right');
        } else if (index === (currentIndex - 1 + totalCards) % totalCards) {
            card.classList.add('inactive-left');
        }
    });
}

document.querySelector('.right-arrow').addEventListener('click', () => {
    currentIndex = (currentIndex + 1) % totalCards;
    updateCards();
});

document.querySelector('.left-arrow').addEventListener('click', () => {
    currentIndex = (currentIndex - 1 + totalCards) % totalCards;
    updateCards();
});

updateCards();

document.querySelectorAll('#joy, #anger, #sadness').forEach(input => {
    input.addEventListener('input', (event) => {
        const id = event.target.id;
        document.getElementById(`${id}-value`).textContent = event.target.value + "%";
    });
});

function getRandomColorHex() {
    const r = Math.floor(Math.random() * 156) + 50;
    const g = Math.floor(Math.random() * 156) + 50;
    const b = Math.floor(Math.random() * 156) + 50;
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function addEmotion(emotion) {
    if (!emotion) return;
    const emotionItem = document.createElement('li');
    emotionItem.textContent = emotion;
    emotionItem.style.backgroundColor = getRandomColorHex();
    document.getElementById('emotions-list').appendChild(emotionItem);
}

function setPersonalityDescription(text) {
    const formattedText = formatText(text);
    document.getElementById('personality-description').innerHTML = formattedText;
}

function addDiaryEntry(entry) {
    if (!entry) return;
    const entryItem = document.createElement('li');
    entryItem.textContent = entry;
    document.getElementById('diary-entries').appendChild(entryItem);
}

function setPsychologicalDescription(description) {
    document.getElementById('psychological-description').textContent = description;
}
function pause(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}
document.addEventListener('DOMContentLoaded', async () => {
    if (localStorage.getItem("userData")) {
        userData = JSON.parse(localStorage.getItem("userData"));
        if (userData.banned) {
            window.location.href = '/banned';
        }
        console.log(userData);
        if (userData.chat) {
            console.log(userData.chat);
            console.log("populating...");
            populateChatFromList(userData.chat);
        }
        if (userData.currentPlaygroundChatIndex){
            currentPlaygroundChatIndex = userData.currentPlaygroundChatIndex;
            console.log(currentPlaygroundChatIndex)
        }
        if (userData.playgroundChat) {
            populatePlaygroundChatFromList(userData.playgroundChat[currentPlaygroundChatIndex].chat);
            populatePlaygroundButtons(userData.playgroundChat);
        } else {
            userData.playgroundChat = [{
                name: "Новое обсуждение",
                chat: []
            }]
            populatePlaygroundButtons(userData.playgroundChat);
            await pause(500)
            console.log("save")
            localStorage.setItem('userData', JSON.stringify(userData));
            socket.emit('saveSettings', userData);
        }
        if (!userData.firstConversationTime) {
            userData.firstConversationTime = getMoscowTime();
        }
        if (!userData.relationshipState) {
            userData.relationshipState = "Ваше знакомство только началось";
        }
        if (!userData.modelName) {
            userData.modelName = "meta-llama/llama-3.1-70b-instruct:free";
        }
        socket.emit("login", userData);
        document.getElementById('username').value = userData.username;
        document.getElementById('real-name').value = userData.realName;
        document.getElementById('gender').value = userData.gender;
        document.getElementById('about').value = userData.bio;
        document.getElementById('birth-date').value = userData.birthdate;
        document.getElementById('groq-api-key').value = userData.apiKey;
        document.getElementById('model').value = userData.modelName;
    } else {
        window.location.href = '/open';
    }
    updatePersonalityTab();
    setPsychologicalDescription("Стабильное психологическое состояние без значительных эмоциональных колебаний.");
});

function handleSmartSearch() {
    const query = document.getElementById('smart-search-input').value.trim();
    if (!query || isSearching) return;

    isSearching = true;

    socket.emit('smart_search', query);
}

function showLoadingAnimation() {
    const resultContainer = document.getElementById('smart-search-result');
    resultContainer.innerHTML = `<div class="loading-spinner"></div>`;
}

function logout() {
    localStorage.removeItem('userData');
    window.location.href = '/open';
}

function getMoscowTime() {
    const now = new Date();
    const moscowOffset = 3;
    const moscowTime = new Date(now.setUTCHours(now.getUTCHours() + moscowOffset));

    const options = {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    };
    const formattedTime = moscowTime.toLocaleString("ru-RU", options);

    console.log(formattedTime);

    return formattedTime;
}

function separateSystemMessages(messages) {
    const systemMessages = [];
    const chatMessages = [];

    if (!messages) return { chatMessages, systemMessages };

    messages.forEach(message => {
        if (message.role === 'system' && message.content.startsWith('Ваше рассуждение наедине:\n')) {
            systemMessages.push(message);
        } else {
            chatMessages.push(message);
        }
    });

    return { chatMessages, systemMessages };
}

function updatePersonalityTab() {
    const description = userData.assistantDescription;
    console.log(description);
    const { chatMessages, systemMessages } = separateSystemMessages(userData.chat);
    if (chatMessages[0]) {
        setPersonalityDescription(description);
        systemMessages.forEach(message => addDiaryEntry(message.content));
        socket.emit("get-emotional-parameters", userData.chat.slice(-8, userData.chat.length - 1));
    }
}
