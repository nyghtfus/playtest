const wppconnect = require('@wppconnect-team/wppconnect');

wppconnect.create({
  session: 'session-name',
  headless: true,
  useChrome: false, // use Chromium instead of Chrome
  browserArgs: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--single-process', // <- necessário para containers do Docker
    '--disable-gpu'
  ]
}).then(client => {


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
}).catch(error => console.log(error));