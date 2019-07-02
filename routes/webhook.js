'use strict';
var express = require('express');
var router = express.Router();

// Imports firebase database
const adminFirebase = require('firebase-admin');
const serviceAccountFirebase = require("../serviceAccountKeyFirebase.json");

// Imports dependency and setup http request
const requestPromise = require('request-promise');

// init firebase database
adminFirebase.initializeApp({
    credential: adminFirebase.credential.cert(serviceAccountFirebase),
    databaseURL: "https://ueter-chatbot.firebaseio.com"
});

// facebook sdk token
const pageToken = 'EAAHa5utZBoAkBAPwwWRTiEb3IzZCYZBE6J02EIL6MQZCz9Taf5J8aecTHZBvkze4yZCAMHi3gXKM7HqYWrRKSw6sgqU0ylzUU0NRDOgzQjQSuZB59qGeXrizVz4A0lZAWMOIqfem8qG4auyFzZBk4JXklCwDsmQFNdxhFWW8KduJ2nNGFr8CnWmXf';
const  urlApi = 'https://graph.facebook.com/v3.3/me/messages?access_token=' + pageToken;

//firebase 
const firebaseDatabase = adminFirebase.database();

// function to get 2 sender id to chat
function getSenderQueueToChat() {
    return new Promise((resolve, reject) => {
        firebaseDatabase.ref('queue').orderByChild('sender_id').limitToFirst(2).on("value", function (snapshot) {
            resolve(snapshot.val());
        });
    })
}

// function to check senderId exists in queue
function checkSenderIdExistsInQueue(senderIdSearch) {
    return new Promise((resole, reject) => {
        firebaseDatabase.ref('queue').orderByChild('sender_id').equalTo(senderIdSearch).on("value", function (snapshot) {
            resole(snapshot.val());
        });
    });
}

// function check senderId exists in chatting
function checkSenderIdExistsInChatting(messengerIdSearch) {
    return new Promise((resole, reject) => {
        firebaseDatabase.ref('chatting').orderByKey().equalTo(messengerIdSearch).on("value", function (snapshot) {
            resole(snapshot.val());
        });
    });
}

/* GET home page. */
router.get('/', async function (req, res, next) {
    // Your verify token. Should be a random string.
    let VERIFY_TOKEN = "ma_xac_minh";

    // Parse the query params
    let mode = req.query['hub.mode'];
    let token = req.query['hub.verify_token'];
    let challenge = req.query['hub.challenge'];

    // Checks if a token and mode is in the query string of the request
    if (mode && token) {

        // Checks the mode and token sent is correct
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {

            // Responds with the challenge token from the request
            res.status(200).send(challenge);

        } else {
            // Responds with '403 Forbidden' if verify tokens do not match
            res.sendStatus(403);
        }
    }
});

router.post('/', async function (req, res, next) {
    let body = req.body;

    let webhook_event = null;

    // Checks this is an event from a page subscription
    if (body.object === 'page') {

        // Iterates over each entry - there may be multiple if batched
        body.entry.forEach(function (entry) {
            // Gets the message. entry.messaging is an array, but
            // will only ever contain one message, so we get index 0
            webhook_event = entry.messaging[0];
        });

        if (webhook_event['message'] !== undefined && webhook_event['message']['is_echo'] !== true) {

            let messageOfUser = webhook_event['message']['text'];

            console.log(webhook_event);

            let messengerId = await checkSenderIdExistsInChatting(webhook_event['sender']['id']);
            console.log('messenger_id>>>' + webhook_event['sender']['id']);
            console.log(messengerId);

            let responseMessageFromServer = "Đây là tin nhắn tự động từ autobot, from Nodejs Server! BOT đang trong quá trình hoàn thiện chưa triển khai. Dev: Lê Việt Thắng!";

            if (messageOfUser !== undefined && messageOfUser !== null && messageOfUser.toUpperCase() === 'START') {

                 let senderToChat = await getSenderQueueToChat();

                let senderExists = await checkSenderIdExistsInQueue(webhook_event.sender.id);

                if (senderExists !== null) {
                    responseMessageFromServer = 'Đang tìm kiếm đối phương, xin bạn vui lòng đợi';
                }

                let senderIdConnect = null;

                let senderKeyFirst = Object.keys(senderToChat)[0];

                let senderKeySecond = Object.keys(senderToChat)[1];

                if (senderKeyFirst !== undefined && senderKeyFirst !== null && senderKeySecond !== undefined && senderKeySecond !== null) {
                    let senderIdFirst = senderToChat[senderKeyFirst]['sender_id'];

                    let senderIdSecond = senderToChat[senderKeySecond]['sender_id'];

                    if (senderKeyFirst !== null && senderKeySecond !== null) {
                        if (senderIdFirst !== webhook_event['sender']['id']) {
                            senderIdConnect = senderIdFirst;
                        } else {
                            senderIdConnect = senderIdSecond;
                        }

                        firebaseDatabase.ref('queue').child(senderKeyFirst).remove();
                        firebaseDatabase.ref('queue').child(senderKeySecond).remove();
                    }

                    firebaseDatabase.ref('chatting').child(senderIdConnect).push(webhook_event.sender.id);
                    firebaseDatabase.ref('chatting').child(webhook_event.sender.id).push(senderIdConnect);
                }

                console.log(senderToChat);

               // responseMessageFromServer = '*Đã tìm thấy đối phương* Hãy nhắn tin để làm quen nào';
            }

            if (messageOfUser !== undefined && messageOfUser !== null && messageOfUser.toUpperCase() === 'END') {
                responseMessageFromServer = "*Cuộc trò chuyện đã kết thúc!* Gõ \"start\" để bắt đầu tìm kiếm.";
            }

            let dataSend = {
                "messaging_type": "RESPONSE",
                "recipient": {
                    "id": webhook_event['sender']['id']
                },
                "message": {
                    "text": responseMessageFromServer
                }
            };

            let options = {
                method: 'POST',
                uri: urlApi,
                body: dataSend,
                headers: {
                    "Content-type": "application/json; charset=UTF-8"
                },
                json: true
            };

            let existsData = false;

            let senderIdExists = await checkSenderIdExistsInQueue(webhook_event['sender']['id']);

            if (senderIdExists !== null) {
                existsData = true;
            }

            if (!existsData) {
                firebaseDatabase.ref('queue').push({ "sender_id": webhook_event['sender']['id'] });
            }

            requestPromise(options).then(fbRes => {
                console.log('sent response message');
            });
        }
    }

    // Returns a '200 OK' response to all requests
    res.status(200).send('EVENT_RECEIVED');
});

module.exports = router;
