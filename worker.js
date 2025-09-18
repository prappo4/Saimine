const TELEGRAM_BOT = '7290022781:AAGUltvI2uTIrA3LKITgVUIZUV_AthKJXC8';
const CHAT_ID = '-1002834450973';

addEventListener('fetch', e => e.respondWith(handle(e.request)));

async handle(req) {
  const url = new URL(req.url);
  const path = url.pathname;

  // CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
  if (req.method === 'OPTIONS') return new Response(null, {headers});

  // simple in-memory store (use CF KV in production)
  const store = (global.store = global.store || {});

  if (path === '/sync') {
    const {userId, state} = await req.json();
    store[userId] = state;
    return new Response(JSON.stringify({ok: true}), {headers});
  }

  if (path === '/leaderboard') {
    // return top 100 by mainBalance
    const list = Object.entries(store)
      .map(([id, st]) => ({id, name: st.userName || 'User', bal: st.mainBalance || 0, pic: st.userPic || ''}))
      .sort((a, b) => b.bal - a.bal)
      .slice(0, 100);
    return new Response(JSON.stringify(list), {headers});
  }

  if (path === '/invite') {
    const {inviter, invitee} = await req.json();
    const invSt = store[inviter] || {};
    invSt.teamCount = (invSt.teamCount || 0) + 1;
    invSt.spinsLeft = (invSt.spinsLeft || 0) + 1;
    invSt.teamCommission = (invSt.teamCommission || 0) + 100;
    invSt.mainBalance = (invSt.mainBalance || 0) + 100;
    store[inviter] = invSt;
    // notify
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT}/sendMessage`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: `🎉 New valid invite!\nInviter: ${inviter}\nInvitee: ${invitee}\nInviter got +100 SAI +1 spin.`
      })
    });
    return new Response(JSON.stringify({ok: true}), {headers});
  }

  if (path === '/withdraw') {
    const body = await req.json();
    const txt = `🔽 WITHDRAW REQUEST 🔽
Name: ${body.name}
UserId: ${body.userId}
Amount: ${body.amount} SAI
Address: ${body.address}
Network: ${body.method}
History snapshot: ${JSON.stringify(body.history, null, 2)}
Time: ${body.date}`;
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT}/sendMessage`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({chat_id: CHAT_ID, text: txt})
    });
    return new Response(JSON.stringify({ok: true}), {headers});
  }

  return new Response('not found', {status: 404});
}
