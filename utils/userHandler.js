// userHandler.js
const crypto = require('crypto');
const { bucket } = require('./firebaseConfig');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const {configDotenv} = require("dotenv");
const fs = require('fs').promises;

function delay(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}

// Функция для шифрования данных
function encrypt(text, password) {
    // Generate a random IV
    const iv = crypto.randomBytes(16);

    // Derive key from password using a hash function (e.g., SHA-256)
    const key = crypto.createHash('sha256').update(password).digest();

    // Create cipher instance with algorithm, key, and IV
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

    // Encrypt the text
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Return the IV and encrypted text in hex format
    return iv.toString('hex') + encrypted;
}

// Функция для дешифрования данных
function decrypt(encrypted, password) {
    try {
        const encryptedBuffer = Buffer.from(encrypted, 'hex');
        const iv = encryptedBuffer.slice(0, 16);
        const encryptedText = encryptedBuffer.slice(16);
        const key = crypto.createHash('sha256').update(password).digest();
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString('utf8');
    } catch (err) {
        throw err;
    }
}

// Функция для загрузки данных пользователя в Firebase Storage
async function uploadUserData(username, data) {
    const file = bucket.file(`users/${username}/userData.txt`);
    const uuid = uuidv4();
    await file.save(data, {
        metadata: {
            metadata: { firebaseStorageDownloadTokens: uuid }
        }
    });
}

// Функция для загрузки данных пользователя из Firebase Storage
async function downloadUserData(username, password) {
    const filePath = `users/${username}/userData.txt`;

    try {
        // Загрузка данных непосредственно в память
        const [dataBuffer] = await bucket.file(filePath).download();

        // Преобразование данных в строку и расшифровка
        const data = dataBuffer.toString('utf8');
        const decryptedData = decrypt(data.trim(), password);

        return decryptedData;
    } catch (err) {
        throw err;
    }
}


// Регистрация пользователя
async function registerUser(jsonData) {
    const userData = jsonData;
    const encryptedData = encrypt(JSON.stringify(userData), userData.password);
    await uploadUserData(userData.email, encryptedData);
    return { success: true, message: 'User registered successfully.' };
}

// Вход пользователя
async function loginUser({ username, password }) {
    try {
        const userData = await downloadUserData(username, password); // Ждем, пока данные будут загружены
        console.log('User Data:', userData);
        return { success: true, userData: JSON.parse(userData) };
    } catch (err) {
        return { success: false, message: 'Wrong username or password' };
    }
}

async function saveUData({ username, password, data }){
    console.log(username + ', ' + password + ', ' + data)
    const encryptedData = encrypt(data, password);
    await uploadUserData(username, encryptedData);
    return { success: true, message: 'Data update successfully' };
}

module.exports = {
    registerUser,
    loginUser,
    saveUData,
    downloadUserData
};
