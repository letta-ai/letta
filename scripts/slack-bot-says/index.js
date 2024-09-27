const message = process.argv[2];

fetch('https://hooks.slack.com/services/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', {
  method: 'POST',
  body: JSON.stringify({ text: message }),
})
