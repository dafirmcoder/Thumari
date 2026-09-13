import webpush from 'web-push';

function generate() {
  const vapidKeys = webpush.generateVAPIDKeys();
  console.log('\nGenerated Web Push VAPID Keys:');
  console.log('--------------------------------------------------');
  console.log(`VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
  console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
  console.log('--------------------------------------------------');
  console.log('Copy these into your .env file.\n');
}

generate();
