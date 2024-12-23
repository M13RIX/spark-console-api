// firebaseConfig.js
const admin = require('firebase-admin');
const serviceAccount = require('../firebase.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: 'source-410210.appspot.com'
});

const bucket = admin.storage().bucket();

module.exports = { bucket };
