const http = require('http');
const https = require('https');

const ICS_URL = process.env.ICS_URL;
const PORT = process.env.PORT || 3000;

function fetchICS(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function transformICS(icsText) {
  const lines = icsText.split(/\r?\n/);
  const result = [];
  let currentLocation = '';
  let summaryIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('BEGIN:VEVENT')) {
      currentLocation = '';
      summaryIndex = -1;
      result.push(line);
    } else if (line.startsWith('LOCATION:')) {
      currentLocation = line.slice('LOCATION:'.length).trim();
      // не добавляем LOCATION в вывод — TickTick его игнорирует
    } else if (line.startsWith('SUMMARY:')) {
      summaryIndex = result.length;
      result.push(line); // временно без аудитории
    } else if (line.startsWith('END:VEVENT')) {
      // Вставляем аудиторию в SUMMARY перед закрытием события
      if (summaryIndex !== -1 && currentLocation) {
        result[summaryIndex] = result[summaryIndex] + ' [' + currentLocation + ']';
      }
      result.push(line);
    } else {
      result.push(line);
    }
  }

  return result.join('\r\n');
}

const server = http.createServer(async (req, res) => {
  if (req.url !== '/calendar.ics') {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  if (!ICS_URL) {
    res.writeHead(500);
    res.end('ICS_URL environment variable not set');
    return;
  }

  try {
    const raw = await fetchICS(ICS_URL);
    const modified = transformICS(raw);

    res.writeHead(200, {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Cache-Control': 'no-cache',
    });
    res.end(modified);
  } catch (err) {
    res.writeHead(502);
    res.end('Failed to fetch calendar: ' + err.message);
  }
});

server.listen(PORT, () => {
  console.log(`ICS proxy running on port ${PORT}`);
});
