import { useEffect } from 'react';
import { registerPushToken } from '../api';

export default function PushManager() {
  useEffect(() => {
    // Only run if OneSignal is available
    if (window.OneSignal) {
      window.OneSignal.push(function() {
        window.OneSignal.on('subscriptionChange', async function(isSubscribed) {
          if (isSubscribed) {
            try {
              const userId = await window.OneSignal.getUserId();
              // Try to get user name from local storage or ask
              let userName = localStorage.getItem('drevo_user_name');
              if (!userName) {
                userName = prompt("Qual o seu nome para receber as notificações?");
                if (userName) localStorage.setItem('drevo_user_name', userName);
              }
              if (userName && userId) {
                await registerPushToken(userName, userId);
                console.log("Push token registrado!");
              }
            } catch (e) {
              console.error("Erro ao registrar token", e);
            }
          }
        });
      });
    }
  }, []);

  return null;
}
