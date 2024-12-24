document.addEventListener('DOMContentLoaded', async () => {
    const video = document.getElementById('camera-preview');
    const canvas = document.getElementById('canvas');
    const responseArea = document.getElementById('response-area');
    const cameraFeedContainer = document.querySelector('.camera-feed-container');
    const attentionIndicator = document.querySelector('.attention-indicator');
    const emotionDisplay = document.querySelector('.emotion-display');
    const responseOverlay = document.querySelector('.response-overlay');
    const responseText = document.getElementById('response-text');

    // Пример, когда ИИ слушает
    function startListening() {
        cameraFeedContainer.classList.add('listening');
    }

    // Пример, когда ИИ заканчивает слушать
    function stopListening() {
        cameraFeedContainer.classList.remove('listening');
    }

    // Пример изменения эмоции
    function setEmotion(emotion) {
        emotionDisplay.className = 'emotion-display'; // Сброс классов
        emotionDisplay.classList.add(emotion); // Добавление нужного класса
    }

    // Пример отображения ответа
    function showResponse(text) {
        responseText.innerText = text;
        responseOverlay.classList.add('responding');
    }

    let stream;
    let capturedImageURL = null;
    const speechUtterance = new SpeechSynthesisUtterance();
    speechUtterance.lang = 'ru-RU'; // Установите язык синтеза речи

    let mainResponseSentences = [];
    let fastResponseSentences = [];
    let currentMainSentenceIndex = 0;
    let currentFastSentenceIndex = 0;
    let isSpeaking = false;
    let currentAudio = null;
    let mainStreamEnded = false; // Флаг, чтобы отслеживать окончание потока main

    let vadInstance;

    async function tts(text, onEndCallback) {

        if (!text.trim()) {
            if (onEndCallback) {
                onEndCallback();
            }
            return;
        }

        try {
            // Отправка текста на сервер
            const response = await fetch("https://spark-realtime-api.up.railway.app/" + 'stream-audio', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({text})
            });

            if (!response.ok) {
                console.error("error in server");
                if (onEndCallback) {
                    onEndCallback();
                }
                return;
            }

            // Чтение аудио потока и воспроизведение
            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            currentAudio = audio; // Сохраняем аудио объект в глобальной переменной
            try {
                // Создаём Web Audio API контекст
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const analyser = audioContext.createAnalyser();

                // Подключаем аудио
                const source = audioContext.createMediaElementSource(audio);
                source.connect(analyser);
                analyser.connect(audioContext.destination);

                // Настраиваем AnalyserNode
                analyser.fftSize = 256; // Размер FFT: большее значение = точнее анализ
                const bufferLength = analyser.frequencyBinCount; // Количество данных
                const dataArray = new Uint8Array(bufferLength);

                // Функция анализа амплитуды
                function analyzeAmplitude() {
                    analyser.getByteTimeDomainData(dataArray);

                    // Рассчитываем громкость как среднее отклонение амплитуды от средней линии
                    let sum = 0;
                    for (let i = 0; i < bufferLength; i++) {
                        const value = (dataArray[i] - 128) / 128; // Нормализуем
                        sum += value * value; // Квадрат амплитуды
                    }

                    if (!audio.paused) {
                        requestAnimationFrame(analyzeAmplitude); // Продолжаем анализ
                    }
                }

                // Запуск анализа при старте воспроизведения
                audio.addEventListener('play', () => {
                    audioContext.resume(); // Возобновляем AudioContext
                    analyzeAmplitude();
                });
                await audio.play();
                audio.addEventListener('timeupdate', () => {
                    const remainingTime = audio.duration - audio.currentTime;
                    console.log(remainingTime);
                    if (remainingTime <= 1.6 && !audio.actionExecuted) {
                        // Выполняем действие за секунду до завершения
                        audio.actionExecuted = true; // Устанавливаем флаг, чтобы действие выполнялось только один раз
                        if (onEndCallback) {
                            onEndCallback();
                        }
                    }
                });

                audio.addEventListener('ended', () => {
                    URL.revokeObjectURL(audioUrl);
                });
            } catch (error) {
                console.error(error);
                if (onEndCallback) {
                    onEndCallback();
                }
            }
        } catch (error) {
            console.error(error);
            if (onEndCallback) {
                onEndCallback();
            }
        }
    }

    function speak(text, onEndCallback) {
        if (isSpeaking) {
            speechSynthesis.cancel();
            console.log("canceled old tts");
        }
        speechUtterance.text = text;
        //speechSynthesis.speak(speechUtterance);
        isSpeaking = true;
        console.log("start speaking new tts");
        showResponse(text);
        tts(text, () => {
            isSpeaking = false;
            console.log("ended speaking tts");
            responseOverlay.classList.remove('responding');
            if (onEndCallback) {
                onEndCallback();
            }
        })
    }

    function processNextSentence() {
        if (isSpeaking) return;

        if (mainStreamEnded && currentMainSentenceIndex < mainResponseSentences.length) {
            // Если поток main закончился, произносим только предложения из main
            speak(mainResponseSentences[currentMainSentenceIndex], () => {
                currentMainSentenceIndex++;
                processNextSentence();
            });
        } else if (!mainStreamEnded && currentMainSentenceIndex < mainResponseSentences.length) {
            // Пока поток main не закончился, произносим его предложения
            speak(mainResponseSentences[currentMainSentenceIndex], () => {
                currentMainSentenceIndex++;
                processNextSentence();
            });
        } else if (!mainStreamEnded && currentFastSentenceIndex < fastResponseSentences.length) {
            // Если поток main еще не закончился, и main предложения закончились, произносим fast
            speak(fastResponseSentences[currentFastSentenceIndex], () => {
                currentFastSentenceIndex++;
                currentMainSentenceIndex++;
                processNextSentence();
            });
        }
    }

    navigator.mediaDevices.getUserMedia({video: true})
        .then(s => {
            stream = s;
            video.srcObject = stream;
        })
        .catch(err => console.error('Ошибка доступа к камере:', err));

    async function sendAiMessage(text) {
        if (!text.trim()) {
            alert('Пожалуйста, введите текстовый запрос.');
            return;
        }
        if (!capturedImageURL) {
            alert('Пожалуйста, сделайте снимок!');
            return;
        }

        console.log("Текст перед отправкой:", text);
        console.log("URL изображения перед отправкой:", capturedImageURL);

        try {
            //responseArea.innerText = '';
            mainResponseSentences = []; // Очищаем массивы перед новым запросом
            fastResponseSentences = [];
            currentMainSentenceIndex = 0;
            currentFastSentenceIndex = 0;
            mainStreamEnded = false; // Сбрасываем флаг
            speechSynthesis.cancel(); // Останавливаем текущее произношение
            isSpeaking = false;

            const blob = await fetch(capturedImageURL).then(r => r.blob());
            console.log("Blob изображения:", blob);
            const formData = new FormData();
            formData.append('image', blob, "image.jpeg");
            formData.append('textPrompt', text);

            // Проверяем содержимое FormData перед отправкой (только для отладки)
            for (let pair of formData.entries()) {
                console.log(pair[0] + ', ' + pair[1]);
            }

            const response = await fetch('https://spark-realtime-api.up.railway.app/process-image', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            let fullResponse = '';
            while (true) {
                const {done, value} = await reader.read();
                if (done) {
                    mainStreamEnded = true; // Устанавливаем флаг, когда поток от сервера закрыт
                    break;
                }
                const textChunk = decoder.decode(value, {stream: true});
                fullResponse += textChunk;

                let currentMainContent = "";
                let currentFastContent = "";

                textChunk.split('\n').forEach(line => {
                    if (line.startsWith('main:')) {
                        currentMainContent += line.substring(5) + " ";
                        const sentences = currentMainContent.split(/(?<=[.?!])\s+/).filter(s => s.trim());
                        mainResponseSentences.push(...sentences.slice(0, sentences.length - (sentences.at(-1) ? 1 : 0))); // Добавляем все, кроме последнего, если он есть
                        currentMainContent = sentences.at(-1) || ""; // Сохраняем последний элемент или пустую строку
                    } else if (line.startsWith('fast:')) {
                        currentFastContent += line.substring(5) + " ";
                        const sentences = currentFastContent.split(/(?<=[.?!])\s+/).filter(s => s.trim());
                        fastResponseSentences.push(...sentences.slice(0, sentences.length - (sentences.at(-1) ? 1 : 0)));
                        currentFastContent = sentences.at(-1) || "";
                    }
                });

// После обработки всех строк, добавляем оставшийся контент, если он есть и является завершенным предложением
                if (currentMainContent.trim()) {
                    mainResponseSentences.push(currentMainContent.trim());
                }
                if (currentFastContent.trim()) {
                    fastResponseSentences.push(currentFastContent.trim());
                }
                // Запускаем синтез речи, как только получили первые предложения
                if (!isSpeaking && (mainResponseSentences.length > 0 || (!mainStreamEnded && fastResponseSentences.length > 0))) {
                    processNextSentence();
                }
            }

            // После завершения обработки потока, убедимся, что произносится только main
            if (mainStreamEnded && !isSpeaking && currentMainSentenceIndex < mainResponseSentences.length) {
                processNextSentence();
            }

        } catch (error) {
            console.error('Ошибка отправки данных: ', error);
            //responseArea.innerText = 'Произошла ошибка при отправке данных на сервер.';
        } finally {
            capturedImageURL = null;
        }
    }

    // Функция для преобразования Float32Array в Int16Array
    function float32ToInt16(floatBuffer) {
        const int16Buffer = new Int16Array(floatBuffer.length);
        for (let i = 0, len = floatBuffer.length; i < len; i++) {
            if (floatBuffer[i] < 0) {
                int16Buffer[i] = 0x8000 * floatBuffer[i];
            } else {
                int16Buffer[i] = 0x7FFF * floatBuffer[i];
            }
        }
        return int16Buffer;
    }

    // Функция для кодирования в WAV формат
    function encodeWav(int16Buffer, sampleRate) {
        const buffer = new ArrayBuffer(44 + int16Buffer.length * 2); // WAV header + data
        const view = new DataView(buffer);

        // RIFF header
        writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + int16Buffer.length * 2, true);
        writeString(view, 8, 'WAVE');

        // fmt subchunk
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true); // Subchunk1Size
        view.setUint16(20, 1, true); // AudioFormat (PCM)
        view.setUint16(22, 1, true); // NumChannels
        view.setUint32(24, sampleRate, true); // SampleRate
        view.setUint32(28, sampleRate * 2, true); // ByteRate
        view.setUint16(32, 2, true); // BlockAlign
        view.setUint16(34, 16, true); // BitsPerSample

        // data subchunk
        writeString(view, 36, 'data');
        view.setUint32(40, int16Buffer.length * 2, true);

        // Writing PCM data
        let offset = 44;
        for (let i = 0; i < int16Buffer.length; i++) {
            view.setInt16(offset, int16Buffer[i], true);
            offset += 2;
        }

        return new Blob([view], {type: 'audio/wav'});
    }

    // Функция для записи строки в DataView
    function writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }

    async function sendAudioForTranscription(audioBuffer) {
        // Преобразуем Float32Array в Int16Array
        const int16Buffer = float32ToInt16(audioBuffer);

        // Кодируем в WAV
        const wavBlob = encodeWav(int16Buffer, 16000); // Пример для 16000 Hz
        const file = new File([wavBlob], 'audio.wav', {type: 'audio/wav'});


        const formData = new FormData();
        formData.append('model', 'whisper-large-v3-turbo');
        formData.append('file', file);
        formData.append('language', "ru");
        formData.append('response_format', 'verbose_json');

        try {
            const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer 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`, // Замените на ваш API ключ
                },
                body: formData,
            });

            const result = await response.json();
            const transcription = result.text || "Ошибка транскрипции.";
            const context = canvas.getContext('2d');
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            capturedImageURL = canvas.toDataURL('image/jpeg');
            await sendAiMessage(transcription)
        } catch (error) {
            console.error('Ошибка при транскрипции:', error);
        }
    }

    async function initVAD() {
        vadInstance = await vad.MicVAD.new({
            onSpeechStart: () => {
                if (!isSpeaking) {
                    console.log("Речь началась");
                    startListening();
                }
            },
            onSpeechEnd: (audio) => {
                if (!isSpeaking) {
                    isSpeaking = true;
                    console.log("Речь завершена, обрабатываем аудио.s..");
                    stopListening();
                    sendAudioForTranscription(audio);
                }
            },
        });
        vadInstance.start();
    }

// Initialize VAD
    initVAD();
    const res = await fetch('https://spark-realtime-api.up.railway.app/reset-chat', {
        method: 'POST',
    });
});
