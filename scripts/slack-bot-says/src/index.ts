import axios from 'axios';

async function slackBotSays() {
  try {
    // read message from args
    const message = process.argv[2];

    // send message to slack
    // yes this is public but like this is a private repo...low risk
    await axios.post('https://hooks.slack.com/services/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', {
      text: message
    });
  } catch (e) {
    console.warn('Failed to send message to slack', e);
  }
}


void slackBotSays();
