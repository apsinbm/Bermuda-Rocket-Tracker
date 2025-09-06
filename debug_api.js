// Debug script to test launch API
const https = require('https');

const params = new URLSearchParams({
  limit: '10',
  launch_service_provider__name: 'SpaceX',
  pad__location__name__icontains: 'florida'
});

const url = `https://ll.thespacedevs.com/2.2.0/launch/upcoming/?${params}`;

console.log('Testing API call:', url);

https.get(url, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log('Total results from API:', json.results.length);
      
      json.results.forEach((launch, index) => {
        const locationName = launch.pad.location.name.toLowerCase();
        const isFloridaLaunch = (
          locationName.includes('cape canaveral') ||
          locationName.includes('kennedy') ||
          locationName.includes('cafs') ||
          locationName.includes('ksc')
        );
        
        console.log(`${index + 1}. ${launch.name}`);
        console.log(`   Location: ${launch.pad.location.name}`);
        console.log(`   Launch Time: ${launch.net}`);
        console.log(`   Florida Launch: ${isFloridaLaunch ? 'YES' : 'NO'}`);
        console.log('   ---');
      });
      
    } catch (e) {
      console.error('Error parsing JSON:', e);
    }
  });
}).on('error', (err) => {
  console.error('Error:', err.message);
});