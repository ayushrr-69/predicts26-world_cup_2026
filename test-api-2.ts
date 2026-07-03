import { apiService } from './src/services/api';

async function run() {
  try {
    const matches = await apiService.fetchAllMatches();
    console.log('Matches fetched:', matches.length);
    if (matches.length > 0) {
      console.log('Sample R32 Match:', matches[0]);
      console.log('Sample R16 Match:', matches.find(m => m.round === 'R16'));
      console.log('Sample TBD R16 Match:', matches.find(m => m.round === 'R16' && m.status === 'TBD'));
    }
  } catch (e) {
    console.error('Error:', e);
  }
}
run();
