import fetch from 'node-fetch';

// Common deployment URLs to test
const urlsToTest = [
  // Railway URLs
  'https://lsr-tracker-production.railway.app',
  'https://lsr-tracker-staging.railway.app', 
  'https://lsr-tracker.railway.app',
  
  // Vercel URLs
  'https://lsr-tracker.vercel.app',
  'https://lsr-tracker-git-main.vercel.app',
  
  // Add your custom URLs here
  'https://your-live-app.railway.app',
  'https://your-live-app.vercel.app'
];

async function testUrl(url) {
  try {
    console.log(`🔍 Testing: ${url}`);
    
    // Test basic connectivity
    const response = await fetch(url, { 
      method: 'GET',
      timeout: 5000 
    });
    
    if (response.ok) {
      console.log(`✅ ${url} - Status: ${response.status}`);
      
      // Test API endpoints
      const apiEndpoints = [
        '/api/health',
        '/api/me',
        '/api/entries',
        '/api/admin/users'
      ];
      
      for (const endpoint of apiEndpoints) {
        try {
          const apiResponse = await fetch(`${url}${endpoint}`, { 
            method: 'GET',
            timeout: 3000 
          });
          console.log(`  📡 ${endpoint} - Status: ${apiResponse.status}`);
        } catch (err) {
          console.log(`  ❌ ${endpoint} - Error: ${err.message}`);
        }
      }
      
      return { url, status: 'accessible', response: response.status };
    } else {
      console.log(`❌ ${url} - Status: ${response.status}`);
      return { url, status: 'error', response: response.status };
    }
  } catch (error) {
    console.log(`❌ ${url} - Error: ${error.message}`);
    return { url, status: 'error', error: error.message };
  }
}

async function findLiveEnvironment() {
  console.log('🚀 Searching for live LSR Tracker environment...\n');
  
  const results = [];
  
  for (const url of urlsToTest) {
    const result = await testUrl(url);
    results.push(result);
    console.log(''); // Add spacing
  }
  
  console.log('📊 Results Summary:');
  console.log('==================');
  
  const accessible = results.filter(r => r.status === 'accessible');
  const errors = results.filter(r => r.status === 'error');
  
  if (accessible.length > 0) {
    console.log('\n✅ Accessible environments:');
    accessible.forEach(result => {
      console.log(`  🌐 ${result.url} (Status: ${result.response})`);
    });
    
    console.log('\n💡 To pull data from the first accessible environment, run:');
    console.log(`   LIVE_URL="${accessible[0].url}" node pull-from-live.js`);
  } else {
    console.log('\n❌ No accessible environments found.');
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Check if your live environment is actually deployed');
    console.log('2. Verify the URL in your deployment platform (Railway/Vercel)');
    console.log('3. Make sure the environment is running and accessible');
    console.log('4. Check if there are any authentication requirements');
  }
  
  if (errors.length > 0) {
    console.log('\n❌ Failed environments:');
    errors.forEach(result => {
      console.log(`  🌐 ${result.url} - ${result.error || `Status: ${result.response}`}`);
    });
  }
}

// Run the search
findLiveEnvironment().catch(console.error);
