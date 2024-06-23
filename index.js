const wppconnect = require('@wppconnect-team/wppconnect');
const http = require('http');
const bodyParser = require("body-parser");
const express = require('express');
const app = express();
const server = http.createServer(app);
const { body, validationResult } = require("express-validator");
// const { Pool } = require('pg');


const port = 3000;

// const pool = new Pool({
//     user: 'postgres',
//     host: 'containers-us-west-32.railway.app',
//     database: 'railway',
//     password: 'JndvZdVXUtYE5Lfdw2sa',
//     port: 7887, // Replace with your PostgreSQL port if different
// });

const socketIO= require('socket.io')(server);
const io = socketIO
const logger = require('./util/logger.js');
const { messageSender, messagesFinder, messageFinder, messagesFetcher } = require('./core/core.js');
const { saveMessage } = require('./util/messageUtil.js');

let activeSessions = {}; // Menyimpan informasi sesi aktif


const initApp = async (clientId)  => {
    try {
        const client =  await wppconnect.create({
            session: clientId,
            catchQR: (urlCode) => {
                // console.log('urlCode:', urlCode );
                io.emit('qr', urlCode);
            },
            statusFind: (statusSession, session) => {
                logger.info(`Session ${session} status : ${statusSession}`);
            },
            deviceName: 'Looyal'
        });
        activeSessions[clientId] = client;
        start(client);
        // io.on('connection', (socket) => {
        //     console.log(`New client connected with session ${clientId}`);

        //     // Listen for the 'logout' event from this client and perform the logout operation
        //     socket.on('logout', () => {
        //         client.logout()
        //         .then(() => {
        //             // Perform any other cleanup or logging if needed
        //             console.log('Client logged out successfully.');
        //         })
        //         .catch((err) => {
        //             console.error('Error occurred during logout:', err);
        //         });
        //     });
        //   });
    } catch (err) {
        logger.error(err);
    }
}

const start = ( client ) => {
    client.onMessage(async ( message ) => {
        const { from, type, body, to } = message;
        if (body.toLowerCase() === 'hai') {
            try {
                const result = await client.sendText(from, 'Welcome to Looyal!');
                console.log('Result: ', result); //return object success
            } catch (err) {
                logger.error(`Error when sending: ${err}`);
            }
        }
    })
    client.onAnyMessage(async ( message ) => {
        if (!message) {
            logger.error(`Message is empty, skip saving...`)
        }
        const uploadedMessage = await saveMessage(message)
        if(uploadedMessage){
          console.log(uploadedMessage.chatMessageBody)
          logger.info(`Message successfully saved to database.`)
        }
    })
}

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


app.get("/", (req, res) => {
    res.sendFile(__dirname + "/core/home.html");
});
  
app.get("/device", (req, res) => {
    res.sendFile(__dirname + "/core/device.html");
});
  
app.post("/device", (req, res) => {
    const no = req.body.device;
    res.redirect("/scan/" + no);
});

app.get("/scan/:id", async (req, res) => {
    const clientId = req.params.id;
    try {
      initApp(clientId);
      // res.send(currentQR).Status(200)
      res.sendFile(__dirname + "/core//index.html");
    } catch (error) {
      if (error instanceof AuthenticationError) {
        logger.info(`client ${clientId} authentication failure: ${error.message}`);
        res.sendStatus(401); // Send 401 Unauthorized status code
      } else {
        // Handle other errors
        res.sendStatus(500); // Send 500 Internal Server Error status code or handle it differently
      }
    }
});

app.get("/whatscheck", async (req, res) =>{
    let device = req.query.device
    let number = req.query.number
    const client = activeSessions[device];
    if (!client) {
        return res.status(404).json({ error: 'Client not found' });
    }
    try { 
        let contact = await client.checkNumberStatus(`${number}@c.us`)
        if (contact.numberExists == false){
          return res.status(404).json({ error: 'contact not found' });
        }
        // console.log(contact)
        res.writeHead(200, {
            "Content-Type": "application/json",
        });
        res.end(
            JSON.stringify({
            status: true,
            message: "contact is exist",
            })
        );
    } catch (error) {
        res.writeHead(401, {
            "Content-Type": "application/json",
        });
        res.end(
            JSON.stringify({
            message: "An error occurred",
            error: error.message,
            })
        );
    }
})

app.post("/send",
[ 
    body("from").notEmpty(), //change from "number" to "from" matching to wwebjs property
    body("message"),
    body("to").notEmpty(),
    body("type").notEmpty(),
    body("urlni"),
    body("filename")
], async (req, res) => { 
    const errors = validationResult(req).formatWith(({ message }) => {
        return message;
    });
    if (!errors.isEmpty()) {
        return res.status(422).json({
            status: false,
            message: errors.mapped(),
        });
    } else {
        let messageDetails = req.body;
        console.log(messageDetails)
        try {
            const client = activeSessions[messageDetails.from];
            if (!client) {
                return res.status(404).json({ error: 'Client not found' });
            }
            logger.info('Client found, proceed to send message with messageSender')

            const sentMessageDetails = await messageSender(client, messageDetails)
            
            console.log(sentMessageDetails)
            
            logger.info('Message sent successfully')
            
            res.writeHead(200, {
                "Content-Type": "application/json",
            });
            res.end(
                JSON.stringify({
                    status: true,
                    message: "success",
                })
            );
        } catch (error) {
            res.writeHead(401, {
                "Content-Type": "application/json",
            });
            res.end(
                JSON.stringify({
                    message: "An error occurred",
                    error: error.message,
                })
            );
        }
    }
    }
);

app.post("/sendgroup",
[ 
    body("messages").isArray().notEmpty(),
    body("messages.*.from").notEmpty(),
    body("messages.*.message").notEmpty(),
    body("messages.*.to").isArray().notEmpty(),
    body("messages.*.type").notEmpty(),
    body("messages.*.urlni"),
    body("messages.*.filename")
], async (req, res) => {
    const errors = validationResult(req).formatWith(({ message }) => {
        return message;
    });
    if (!errors.isEmpty()) {
        return res.status(422).json({
            status: false,
            message: errors.mapped(),
        });
    } else {
        let messageDetails = req.body;
        console.log(messageDetails);
  
        try {
            const result = {};
    
            for (const message of messageDetails.messages) {
                const { from: session, message: msg, to: receivers, type, urlni, filename } = message;
                const client = activeSessions[session];
                
                if (!client) { 
                    return res.status(404).json({ error: 'Client not found' });
                } else {
                    logger.info(`Sending message from session ${session}`);
                    for (const receiver of receivers) {
                        try {
                            const sentMessageDetails = await messageSender(client,{
                                from: session,
                                message: msg,
                                to: receiver,
                                type,
                                urlni,
                                filename,
                            });
                            if (!result[session]) {
                                result[session] = {};
                            }
                            if (!result[session][receiver]) {
                                result[session][receiver] = [];
                            }
                            result[session][receiver].push({ status: 'success', sentMessageDetails });
                        
                        } catch (error) {
                            if (!result[session]) {
                                result[session] = {};
                            }
                            if (!result[session][receiver]) {
                                result[session][receiver] = [];
                            }
                            result[session][receiver].push({ status: 'error', error: error.message });
                            console.error(`Error sending message from session ${session} to receiver ${receiver}: ${error.message}`);
                        }
                    }
                }
            }
            console.log(result);

            res.writeHead(200, {
              "Content-Type": "application/json",
            });
            res.end(
              JSON.stringify({
                status: true,
                message: "success",
                result,
              })
            );
        }
        catch (error) {
            res.writeHead(401, {
                "Content-Type": "application/json",
            });
            res.end(
                JSON.stringify({
                    message: "An error occurred",
                    error: error.message,
                })
            );
        }
    }
})
                

// unsend single or multiple messages
app.post("/unsend", async (req, res) => {
    const { device, number, chatId, messageId } = req.body;

    const client = activeSessions[device];

    if (!client) {
        return res.status(404).json({ error: 'Client not found' });
    }

    if (!device || !number || !chatId || !messageId) {
        return res.status(400).json({ error: 'Missing parameters in the request body.' });
    }

    try {
        if (Array.isArray(messageId)) {
            if (messageId.length === 0) return res.send('Messages not found');

            await client.deleteMessage(chatId, messageId);
        } else {
            if (!messageId) return res.send('Message not found');
        
            await client.deleteMessage(chatId, messageId);
        }
    
        return res.send('Message(s) deleted');
    } catch (error) {
        logger.error(error)
    }
})

app.get("/getchat", async (req, res) => {
    let device = req.query.device
    let number = req.query.number
    let limit = parseInt(req.query.limit) // Convert the 'limit' parameter to an integer
    
    let chatId = `${number}@c.us`
  
    const client = activeSessions[device];
  
    if (!device) return res.send('Input Parameter Device');
    if (!number) return res.send('Input Parameter Number Parameter');
    if (!/^\d+$/.test(number)) return res.send('Invalid Number');
  
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    try {
      const messages = await messagesFetcher(client, chatId, limit)
      if(!messages) return res.send('Message not found')
      
      messageBodies = messages.map((message) => message.body)
      return res.send(messageBodies)
    } catch (error) {
      logger.error(error)
    }
  })
  
// start the express server
server.listen(port, () => {
    console.log(`App running on : ${port}`)
  });