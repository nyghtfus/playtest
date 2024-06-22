const wppconnect = require('@wppconnect-team/wppconnect');

wppconnect.create({
  session: 'session-name',
  puppeteerOptions: {
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
}).then((client) => {
  client.onMessage((message) => {
    if (message.body === 'Hi') {
      client.sendText(message.from, 'Hello!');
    }
  });
}).catch((error) => {
  console.error('Error initializing WPPConnect:', error);
});
