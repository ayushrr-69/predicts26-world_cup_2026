import { apiService } from './src/services/api';

async function fetchApiData() {
  const API_ENDPOINTS = [
    { url: 'https://worldcup26.ir/get/games', wrap: false },
    { url: 'https://api.allorigins.win/get?url=' + encodeURIComponent('https://worldcup26.ir/get/games'), wrap: true },
  ];

  for (const endpoint of API_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const targetUrl = endpoint.wrap ? endpoint.url + encodeURIComponent(`?t=${Date.now()}`) : endpoint.url;
      const response = await fetch(targetUrl, { signal: controller.signal });
      clearTimeout(timer);
      if (!response.ok) continue;
      const text = await response.text();
      let data;
      if (endpoint.wrap) {
        const proxyData = JSON.parse(text);
        if (proxyData.contents) {
          data = JSON.parse(proxyData.contents);
        } else {
          continue;
        }
      } else {
        data = JSON.parse(text);
      }
      return data;
    } catch (e) {
      console.error('Fetch error:', e);
    }
  }
  return null;
}

async function run() {
  const data = await fetchApiData();
  console.log('API Data received:', !!data);
  if (data) {
    console.log('Total games:', data.games ? data.games.length : 'no games array');
    console.log(data.games[0]);
  }
}
run();
