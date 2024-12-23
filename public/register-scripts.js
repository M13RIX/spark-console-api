const questions = [
    {
        question: "Как вы обычно реагируете на сложные ситуации?",
        options: ["Спокойно и рационально", "Эмоционально, но сдержанно", "Сильно расстраиваюсь", "Стараюсь сохранять позитив"],
    },
    {
        question: "Что для вас важно в общении с другими людьми?",
        options: ["Прямота и честность", "Поддержка и сочувствие", "Умение рассмешить", "Спокойствие и уверенность"],
    },
    {
        question: "Какой стиль общения вам ближе?",
        options: ["Формальный", "Дружеский", "Легкий и шутливый", "Расслабленный"],
    },
    {
        question: "Что вас может раздражать в общении с ИИ?",
        options: ["Излишняя формальность", "Недостаток эмпатии", "Слишком много шуток", "Навязчивость"],
    },
    {
        question: "Какую роль вы чаще играете в команде?",
        options: ["Лидер", "Советник", "Мотиватор", "Исполнитель"],
    },
    {
        question: "Как бы вы описали свою личность?",
        options: ["Интроверт", "Экстраверт", "Амбиверт", "Зависит от ситуации"],
    },
    {
        question: "Какую информацию вам предпочтительно получать?",
        options: ["Факты и данные", "Мнения и точки зрения", "Рекомендации и советы", "Новости и обновления"],
    },
    {
        question: "Как вы предпочитаете получать информацию?",
        options: ["Кратко и по делу", "С подробным объяснением", "Через примеры и истории", "Через визуальные представления"],
    },
    {
        question: "Какой у вас уровень оптимизма?",
        options: ["Оптимист", "Пессимист", "Реалист", "Зависит от ситуации"],
    },
    {
        question: "Какие эмоции вам ближе?",
        options: ["Радость и счастье", "Спокойствие и удовлетворенность", "Волнение и вдохновение", "Эмпатия и сочувствие"],
    },
    {
        question: "Как вы оцениваете свою креативность?",
        options: ["Высокая", "Средняя", "Низкая", "Зависит от задачи"],
    },
    {
        question: "Насколько для вас важна поддержка других?",
        options: ["Очень важна", "Важно, но не всегда", "Не особо важно", "Предпочитаю справляться самостоятельно"],
    },
    {
        question: "Какой тип взаимодействия вам нравится с ИИ?",
        options: ["Формальный", "Дружеский", "Интерактивный", "Консультативный"],
    },
    {
        question: "Как бы вы предпочли настроить ИИ?",
        options: ["Максимум эмпатии", "Сбалансированный подход", "Минимум эмоций", "Только факты"],
    },
    {
        question: "Что вас может больше всего раздражать в поведении ИИ?",
        options: ["Излишняя болтливость", "Медленная реакция", "Отсутствие эмпатии", "Слишком много советов"],
    },
    {
        question: "Насколько вам важен уровень знаний ИИ?",
        options: ["Максимальный", "Сбалансированный", "Зависит от ситуации", "Минимальный (только базовые ответы)"],
    },
    {
        question: "Насколько вы доверяете ИИ?",
        options: ["Полностью", "Частично", "С осторожностью", "Не доверяю"],
    },
    {
        question: "Какую роль вы хотели бы, чтобы ИИ играл в вашей жизни?",
        options: ["Советник", "Ассистент", "Партнер", "Друг"],
    },
];


let currentQuestion = 0;
const totalQuestions = questions.length;

document.getElementById("total-questions").innerText = totalQuestions;

function showQuestion(index) {
    const questionElement = document.getElementById("question-text");
    const optionsList = document.getElementById("options-list");

    questionElement.textContent = questions[index].question;
    optionsList.innerHTML = ""; // Clear previous options

    questions[index].options.forEach(option => {
        const optionButton = document.createElement("button");
        optionButton.className = "option-button";
        optionButton.textContent = option;
        optionButton.onclick = () => selectOption(option, optionButton);
        optionsList.appendChild(optionButton);
    });

    document.getElementById("custom-answer").value = ""; // Clear custom answer field
    document.getElementById("question-index").innerText = index + 1;
    updateNavigationButtons();
}

function selectOption(option, buttonElement) {
    // Store the selected option for current question
    questions[currentQuestion].selected = option;

    // Highlight the selected option
    const allButtons = document.querySelectorAll(".option-button");
    allButtons.forEach(button => button.classList.remove("selected"));
    buttonElement.classList.add("selected");

    // Enable the Next button
    document.getElementById("next-btn").disabled = false;
}

function checkCustomAnswer() {
    const customAnswer = document.getElementById("custom-answer").value;
    if (customAnswer) {
        questions[currentQuestion].selected = customAnswer;
        document.getElementById("next-btn").disabled = false;
    } else {
        document.getElementById("next-btn").disabled = true;
    }
}

function nextQuestion() {
    if (currentQuestion < totalQuestions - 1) {
        currentQuestion++;
        flipCard(() => showQuestion(currentQuestion)); // Trigger flip animation
    } else {
        // Handle form submission or data processing
        let questionString = "";
        for (let question of questions)
        {
            questionString += "\n\nВопрос: \"" + question.question + "\" Ответ: \"" + question.selected + "\""
        }
        console.log(questionString)
        finishSettings();
    }
}

function prevQuestion() {
    if (currentQuestion > 0) {
        currentQuestion--;
        flipCard(() => showQuestion(currentQuestion)); // Trigger flip animation
    }
}

function updateNavigationButtons() {
    document.getElementById("prev-btn").disabled = currentQuestion === 0;
    document.getElementById("next-btn").disabled = !questions[currentQuestion].selected;
    document.getElementById("next-btn").textContent = currentQuestion === totalQuestions - 1 ? "Завершить" : "Дальше";
}

function flipCard(callback) {
    const questionBox = document.querySelector(".question-box");
    questionBox.style.animation = "flipOut 0.3s ease forwards";

    setTimeout(() => {
        callback(); // Execute the callback to update content
        questionBox.style.animation = "flipIn 0.3s ease";
    }, 300);
}




function finishSettings() {
    document.querySelector('.container').style.display = 'none';
    document.getElementById('loading-screen').style.display = 'flex';

    setTimeout(() => {
        document.getElementById('loading-screen').style.display = 'none';
        document.getElementById('final-screen').style.display = 'flex';
    }, 3000); // Симуляция времени настройки
}

// Initialize the first question
showQuestion(currentQuestion);
