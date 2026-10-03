const fs=require('fs'),u=process.env.SUPABASE_URL,k=process.env.SUPABASE_ANON_KEY,c=[+process.env.CENTER_LAT||17.385,+process.env.CENTER_LNG||78.4867];
if(u&&k){fs.writeFileSync('public/config.js','window.SC_CONFIG='+JSON.stringify({url:u,anon:k,center:c})+';');console.log('config.js written from env')}else console.log('No env keys; keeping public/config.js');
