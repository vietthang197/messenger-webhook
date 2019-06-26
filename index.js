'use strict';

// Imports dependencies and set up http server
const
  express = require('express'),
  bodyParser = require('body-parser'),
  app = express().use(bodyParser.json()); // creates express http server

  const Nexmo = require('nexmo');

  const options = {
  // If true, log information to the console
  debug: true|false,
  // append info the the User-Agent sent to Nexmo
  // e.g. pass 'my-app' for /nexmo-node/1.0.0/4.2.7/my-app
  appendToUserAgent: "my-app",
  // Set a custom timeout for requests to Nexmo in milliseconds. Defaults to the standard for Node http requests, which is 120,000 ms.
  timeout: 111
};

const nexmo = new Nexmo({
    apiKey: 'EAAHa5utZBoAkBAIXB63zRVPE6qIZAZCZC3DHNGUwLG7Y3LwoRsFUDXDOVjO6a4ZBQiy7TtdfPKZAXbgfSFLdMZAXQVQM8hCz3m1ZAkpbZBQwd4GlKZAsiMLBwx6GeCAQqDX6XmxZC0ZCjbwihvsKLFNHFMOG4w1ripELn7ZCXPIlvXHgiWCYfZCXP97K2O',
    apiSecret: '117f440d1783f5ef2387fc1541b8999e',
    applicationId: '522160304988169',
    privateKey: null,
  }, options);

// Sets server port and logs message on success
app.listen(process.env.PORT || 1337, () => console.log('webhook is listening'));

app.get('/', (req, res) => {
	res.status(200).send('CHALLENGE_ACCEPTED');
});

// Creates the endpoint for our webhook 
app.post('/webhook', (req, res) => {  
 
  let body = req.body;

  // Checks this is an event from a page subscription
  if (body.object === 'page') {

    // Iterates over each entry - there may be multiple if batched
    body.entry.forEach(function(entry) {

      // Gets the message. entry.messaging is an array, but 
      // will only ever contain one message, so we get index 0
      let webhook_event = entry.messaging[0];
      
      let sender = webhook_event['sender'];
      let recipient = webhook_event['recipient'];
      console.log('sender:' + sender['id']);
      console.log('recipient:' + recipient['id']);

      nexmo.channel.send(
        { "type": "messenger", "id": recipient['id'] },
        { "type": "messenger", "id": sender['id'] },
        {
          "content": {
            "type": "text",
            "text": "This is a Facebook Messenger Message sent from the Messages API"
          }
        },
        (err, data) => { console.log(data.message_uuid); }
      );
      
    });

    // Returns a '200 OK' response to all requests
    res.status(200).send('EVENT_RECEIVED');
  } else {
    // Returns a '404 Not Found' if event is not from a page subscription
    console.log(body);
    res.sendStatus(404);
  }

});

// Adds support for GET requests to our webhook
app.get('/webhook', (req, res) => {

  // Your verify token. Should be a random string.
  let VERIFY_TOKEN = "ma_xac_minh"
    
  // Parse the query params
  let mode = req.query['hub.mode'];
  let token = req.query['hub.verify_token'];
  let challenge = req.query['hub.challenge'];
    
  // Checks if a token and mode is in the query string of the request
  if (mode && token) {
  
    // Checks the mode and token sent is correct
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      
      // Responds with the challenge token from the request
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);
    
    } else {
      // Responds with '403 Forbidden' if verify tokens do not match
      res.sendStatus(403);      
    }
  }
});