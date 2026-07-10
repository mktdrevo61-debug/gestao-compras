export const API_URL = "https://script.google.com/macros/s/AKfycbxC047PD6PN7rwA6YUicZhm_xV0xF0iDJSE8iW7eVyTIKRztQEKL46iZjtWQ4_sH98G/exec";

export async function fetchOrders() {
  const res = await fetch(`${API_URL}?_=${Date.now()}`);
  return await res.json();
}

export async function createOrder(order) {
  // MOCK: Não envia para a planilha para não sujar a base em produção durante testes
  console.log("Mock createOrder: ", order);
  return new Promise(resolve => setTimeout(resolve, 800));
  
  /*
  return await fetch(API_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      action: "CriarPedido",
      ...order
    })
  });
  */
}

export async function updateOrderStatus(orderId, status) {
  // MOCK: Não envia para a planilha
  console.log("Mock updateOrderStatus: ", orderId, status);
  return new Promise(resolve => setTimeout(resolve, 800));
  
  /*
  return await fetch(API_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      action: "AtualizarStatusPedido",
      orderId,
      status
    })
  });
  */
}

export async function registerPushToken(name, token) {
  // MOCK
  console.log("Mock registerPushToken: ", name, token);
  return new Promise(resolve => setTimeout(resolve, 500));
}

export async function sendPushNotification(title, body) {
  // MOCK
  console.log("Mock sendPush: ", title, body);
  return new Promise(resolve => setTimeout(resolve, 500));
}
