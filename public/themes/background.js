const canvas = document.getElementById("blobCanvas");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const blobs = [];

// Генерация случайных параметров для формы
function randomBlob(x, y, size, color) {
    const points = [];
    const numPoints = 6 + Math.floor(Math.random() * 6);
    for (let i = 0; i < numPoints; i++) {
        const angle = (Math.PI * 2 * i) / numPoints;
        const distance = size + Math.random() * size * 0.3;
        points.push({
            x: Math.cos(angle) * distance,
            y: Math.sin(angle) * distance,
        });
    }
    return { x, y, size, color, points, dx: Math.random() * 0.5 - 0.25, dy: Math.random() * 0.5 - 0.25 };
}

// Создание плавных форм с добавлением размытия
function drawBlob(blob) {
    const { x, y, points, color } = blob;
    ctx.shadowBlur = 80; // Большое размытие
    ctx.shadowColor = color; // Цвет размытия
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x + points[0].x, y + points[0].y);
    for (let i = 1; i < points.length; i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % points.length];
        ctx.quadraticCurveTo(x + p1.x, y + p1.y, x + p2.x, y + p2.y);
    }
    ctx.closePath();
    ctx.fill();
}

// Анимация движения
function animateBlobs() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = "lighter"; // Эффект смешивания цветов
    blobs.forEach((blob) => {
        blob.x += blob.dx;
        blob.y += blob.dy;
        // Изменение формы
        blob.points.forEach((p) => {
            p.x += Math.random() * 2 - 1;
            p.y += Math.random() * 2 - 1;
        });

        // Возврат на экран
        if (blob.x - blob.size > canvas.width) blob.x = -blob.size;
        if (blob.x + blob.size < 0) blob.x = canvas.width + blob.size;
        if (blob.y - blob.size > canvas.height) blob.y = -blob.size;
        if (blob.y + blob.size < 0) blob.y = canvas.height + blob.size;

        drawBlob(blob);
    });

    requestAnimationFrame(animateBlobs);
}

// Инициализация
function init() {
    const colors = [
        "rgba(255,84,22,0.6)",
        "rgba(255,91,59,0.6)",
        "rgba(255,140,0,0.6)",
        "rgba(255,204,0,0.6)",
        "rgba(255,8,52,0.6)"
    ];
    for (let i = 0; i < 15; i++) {
        const size = 50 + Math.random() * 200;
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const color = colors[Math.floor(Math.random() * colors.length)];
        blobs.push(randomBlob(x, y, size, color));
    }
    animateBlobs();
}

init();
window.addEventListener("resize", () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});
