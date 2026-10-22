const express = require('express');
const app = express();

const CLIENT_ID     = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_SECRET;
const REDIRECT      = process.env.REDIRECT;

// discordId -> expiry shown in the menu (add your buyers here)
const subs = {
  "123456789012345678": "11/20",
};
const lookupExpiry = id => subs[id] || "N/A";

const pending = new Map(); // state -> user data

app.get('/', (req, res) => res.send('OK'));

app.get('/auth/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code || !state) return res.status(400).send('Bad request');

    const tok = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT
      })
    }).then(r => r.json());
    if (!tok.access_token) return res.status(400).send('Login failed');

    const user = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tok.access_token}` }
    }).then(r => r.json());

    pending.set(state, {
      id: user.id,
      name: user.global_name || user.username,
      avatar: user.avatar || '',
      expiry: lookupExpiry(user.id)
    });
    setTimeout(() => pending.delete(state), 5 * 60 * 1000);

    res.send('Logged in. You can close this tab.');
  } catch (e) {
    res.status(500).send('Server error');
  }
});

app.get('/auth/poll', (req, res) => {
  const data = pending.get(req.query.state);
  if (!data) return res.json({ ready: false });
  pending.delete(req.query.state);
  res.json({ ready: true, ...data });
});

app.listen(process.env.PORT || 3000);