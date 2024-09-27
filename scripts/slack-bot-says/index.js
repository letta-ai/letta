const message = process.argv[2];

if (!process.env.SLACK_WEBHOOK_URL) {
  console.error('SLACK_WEBHOOK_URL is not set');
  process.exit(0);
}

fetch(process.env.SLACK_WEBHOOK_URL, {
  method: 'POST',
  body: JSON.stringify({ text: message }),
})
