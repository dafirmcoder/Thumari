// Service Worker & PWA Lifecycle Management

let deferredInstallPrompt = null;

// 1. Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        console.log('[PWA] ServiceWorker registered with scope:', reg.scope);
      })
      .catch((err) => {
        console.warn('[PWA] ServiceWorker registration failed:', err);
      });
  });
}

// 2. Capture PWA Installation Prompt (Chrome, Edge, Android)
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;

  const installBanner = document.getElementById('pwa-install-banner');
  if (installBanner) {
    installBanner.classList.add('active');
  }
});

// 3. Trigger Installation when user clicks install button
function triggerPwaInstall() {
  if (!deferredInstallPrompt) {
    alert('To install Thumari on this device, tap your browser menu (⋮ or Share) and select "Add to Home screen" or "Install App".');
    return;
  }
  deferredInstallPrompt.prompt();
  deferredInstallPrompt.userChoice.then((choiceResult) => {
    if (choiceResult.outcome === 'accepted') {
      console.log('[PWA] User accepted installation');
    }
    deferredInstallPrompt = null;
    const installBanner = document.getElementById('pwa-install-banner');
    if (installBanner) {
      installBanner.classList.remove('active');
    }
  });
}

// 4. Web Push Notification Subscription
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function subscribePushNotifications(vapidPublicKey, csrfToken) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    alert('Push notifications are not supported on this browser/platform.');
    return;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    alert('Notification permission was not granted.');
    return;
  }

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();

  if (!sub) {
    if (!vapidPublicKey) {
      alert('Push notification VAPID public key is not configured on the server.');
      return;
    }
    const convertedKey = urlBase64ToUint8Array(vapidPublicKey);
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: convertedKey,
    });
  }

  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': csrfToken,
    },
    body: JSON.stringify(sub.toJSON()),
  });

  if (res.ok) {
    alert('This device has been successfully registered for Web Push notifications!');
    window.location.reload();
  } else {
    alert('Failed to register push subscription on server.');
  }
}

async function sendTestNotification(csrfToken) {
  const res = await fetch('/api/push/test', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': csrfToken,
    },
  });

  if (res.ok) {
    alert('Test notification queued! Check your system notification tray.');
  } else {
    alert('Error queueing test notification.');
  }
}
