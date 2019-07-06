'use strict';
var express = require('express');
var router = express.Router();
var imageChecker = require('is-image-url');

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
const pageToken = 'insert_paqe_token_here';
const urlApiSendText = 'https://graph.facebook.com/v3.3/me/messages?access_token=' + pageToken;
const urlApiSendAttachments = 'https://graph.facebook.com/v3.3/me/message_attachments?access_token=' + pageToken;
const urlApiSendMessageWithAttachments = 'https://graph.facebook.com/v3.3/me/messages?access_token=' + pageToken;
//firebase 
const firebaseDatabase = adminFirebase.database();

// function to get 2 sender id to chat
function getRandomSenderToConnectChat() {
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

// function insert senderId to queue
function insertSenderToQueue(senderId) {
    return new Promise((resole, reject) => {
        firebaseDatabase.ref('queue').push({
            "sender_id": senderId
        }).on('value', function (snapshot) {
            resole(snapshot.val());
        });
    });
}

// send message text from api to facebook
function responseMesseageToFacebook(senderId, messageText) {
    return new Promise((resole, reject) => {
        let dataSend = {
            "messaging_type": "RESPONSE",
            "recipient": {
                "id": senderId
            },
            "message": {
                "text": messageText
            }
        };

        let options = {
            method: 'POST',
            uri: urlApiSendText,
            body: dataSend,
            headers: {
                "Content-type": "application/json; charset=UTF-8"
            },
            json: true
        };

        requestPromise(options).then(fbRes => {
           resole(fbRes);
        });
    });
}

// send attachments from api to facebook
function responseAttachmentsToFacebook(senderId, type, url, stickerId) {
    let dataSend = {
        "message": {
            "attachment": {
                "type": type,
                "payload": {
                    "is_reusable": true,
                    "url": url
                }
            }
        }
    };

    let options = {
        method: 'POST',
        uri: urlApiSendAttachments,
        body: dataSend,
        headers: {
            "Content-type": "application/json; charset=UTF-8"
        },
        json: true
    };

    requestPromise(options).then(fbRes => {
        sendAttachmentIdToFacebook(fbRes['attachment_id'], senderId, type);
    });
}

function sendAttachmentIdToFacebook(attactmentId, senderId, type) {
    let dataSendAttId = {
        "recipient":{
            "id":senderId
        },
        "message":{
            "attachment":{
                "type":type,
                "payload":{
                    "attachment_id": attactmentId
                }
            }
        }
    };

    let optionsMessageAttachments = {
        method: 'POST',
        uri: urlApiSendMessageWithAttachments,
        body: dataSendAttId,
        headers: {
            "Content-type": "application/json; charset=UTF-8"
        },
        json: true
    };

    requestPromise(optionsMessageAttachments).then(fbRes => {
        console.log(fbRes);
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

        try {
            if (webhook_event['message'] !== undefined && webhook_event['message']['is_echo'] !== true) {

                let idSenderServerResponse = webhook_event.sender.id;

                let responseMessageFromServer = "Đây là tin nhắn tự động từ autobot, from Nodejs Server! BOT đang trong quá trình hoàn thiện chưa triển khai. Dev: Lê Việt Thắng!";

                // lấy nội dung tin nhắn của user
                let messageOfUser = webhook_event['message']['text'];

                // gửi ảnh hoặc file
                let attachmentsData = webhook_event['message']['attachments'];

                // log ra thông tin user
                console.log(webhook_event);

                // kiểm tra xem user đang chat hay là tìm kiếm
                let senderOnChatting = await checkSenderIdExistsInChatting(webhook_event['sender']['id']);
                console.log(senderOnChatting);

                // if sender in chatting
                if (senderOnChatting !== undefined && senderOnChatting !== null) {
                    console.log('>>>>> user chatting');
                    let keyMessenger = Object.keys(senderOnChatting[webhook_event.sender.id]);
                    if (messageOfUser !== undefined) {
                        responseMessageFromServer = messageOfUser;
                    } else {
                        responseMessageFromServer = 'server response';
                    }
                    idSenderServerResponse = senderOnChatting[webhook_event.sender.id][keyMessenger];

                    if (messageOfUser !== undefined && messageOfUser !== null) {
                        if (messageOfUser.toUpperCase() === 'END') {
                            firebaseDatabase.ref('chatting').child(idSenderServerResponse).remove();
                            firebaseDatabase.ref('chatting').child(webhook_event.sender.id).remove();
                            await responseMesseageToFacebook(webhook_event.sender.id, '<3 Bạn đã kết thúc trò chuyện, gõ "start" để bắt đầu <3');
                            await responseMesseageToFacebook(idSenderServerResponse, '<3 Đối phương đã kết thúc trò chuyện, gõ "start" để bắt đầu <3');
                        } else if (messageOfUser.toUpperCase() === 'START'){
                          await responseMesseageToFacebook(webhook_event.sender.id, ':) Bạn đang trong cuộc trò chuyện, gõ "end" dể kết thúc :)');
                        } else {
                            await responseMesseageToFacebook(idSenderServerResponse, messageOfUser);
                        }
                    } else if (attachmentsData !== undefined && attachmentsData !== null) {
                        console.log(attachmentsData);
                        let i = 0;
                        for ( i = 0; i < attachmentsData.length; i++) {
                            responseAttachmentsToFacebook(idSenderServerResponse, attachmentsData[i]['type'], attachmentsData[i]['payload']['url']);
                        }
                    }
                }

                // if sender not in chatting
                if ((senderOnChatting === undefined || senderOnChatting === null) && messageOfUser !== undefined && messageOfUser !== null && messageOfUser.toUpperCase() === 'START') {

                    responseMessageFromServer = ':) Đang tìm kiếm đối phương, xin bạn vui lòng đợi :)';
                    await responseMesseageToFacebook(webhook_event.sender.id, responseMessageFromServer);

                    console.log('>>>>>>> start to find user');

                    let senderExists = await checkSenderIdExistsInQueue(webhook_event.sender.id);

                    console.log(senderExists);

                    // sender not in queue
                    if (senderExists === null) {
                        console.log('>>>>>>>>>> user pushed in queue');
                        let valueInsertSenderId = await insertSenderToQueue( webhook_event['sender']['id']);
                        console.log(valueInsertSenderId);
                    }

                    console.log('>>>>>>> user exists in queue');

                    let senderToChat = await getRandomSenderToConnectChat();

                    console.log('>>>>>> value senderToChat');
                    console.log(senderToChat);

                    let senderIdConnect = null;

                    let senderKeyFirst = Object.keys(senderToChat)[0];

                    let senderKeySecond = Object.keys(senderToChat)[1];

                    if (senderKeyFirst !== undefined && senderKeyFirst !== null && senderKeySecond !== undefined && senderKeySecond !== null && senderKeyFirst !== senderKeySecond) {
                        let senderIdFirst = senderToChat[senderKeyFirst]['sender_id'];

                        let senderIdSecond = senderToChat[senderKeySecond]['sender_id'];

                        if (senderIdFirst !== webhook_event['sender']['id']) {
                            senderIdConnect = senderIdFirst;
                        } else if (senderIdConnect === null && webhook_event['sender']['id'] !== senderIdSecond) {
                            senderIdConnect = senderIdSecond;
                        }
                        if (senderIdConnect !== null && senderIdConnect !== webhook_event.sender.id) {
                            firebaseDatabase.ref('queue').child(senderKeyFirst).remove();
                            firebaseDatabase.ref('queue').child(senderKeySecond).remove();
                            firebaseDatabase.ref('chatting').child(senderIdConnect).push(webhook_event.sender.id);
                            firebaseDatabase.ref('chatting').child(webhook_event.sender.id).push(senderIdConnect);

                            console.log('>>>>>>>>>>>>senderIdConnect');
                            console.log(senderIdConnect);

                            await responseMesseageToFacebook(senderIdConnect, ':) Đã tìm thấy đối phương, hãy nhắn tin làm quen ngay nào! :)');
                            await responseMesseageToFacebook(webhook_event.sender.id, ':) Đã tìm thấy đối phương, hãy nhắn tin làm quen ngay nào! :)');
                        }

                    }

                    // responseMessageFromServer = '*Đã tìm thấy đối phương* Hãy nhắn tin để làm quen nào';
                } else if ((senderOnChatting === undefined || senderOnChatting === null) && messageOfUser !== undefined && messageOfUser !== null && messageOfUser.toUpperCase() === 'END') {
                    let senderQueueExists = await checkSenderIdExistsInQueue(webhook_event.sender.id);
                    responseMessageFromServer = ':) Bạn chưa tìm kiếm, hãy gõ "start" để bắt đầu tìm kiếm :)';
                    if (senderQueueExists !== null) {
                        firebaseDatabase.ref('queue').child(Object.keys(senderQueueExists)[0]).remove();
                        responseMessageFromServer = '<3 Bạn đã thoát khỏi hàng chờ , gõ "start" để tìm kiếm đối phương <3';
                    }
                    await responseMesseageToFacebook(webhook_event.sender.id, responseMessageFromServer);
                } else if( senderOnChatting === undefined || senderOnChatting === null){
                    await responseMesseageToFacebook(idSenderServerResponse,  ':) Bạn phải gõ "start" để bắt đầu tìm kiếm :)');
                }


            }
        } catch (e) {
            console.log(e);
            await responseMesseageToFacebook(webhook_event.sender.id, "Server Error");
        }
    }

    // Returns a '200 OK' response to all requests
    res.status(200).send('EVENT_RECEIVED');
});

module.exports = router;