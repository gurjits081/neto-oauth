import express from 'express';
import dotenv from 'dotenv';
import { exchangeToken, getNetoData } from './utils/netoAPI.js';
import crypto from 'crypto';


dotenv.config({
  path: './.env'
});

const app = express();
const port = 3000;

let sessionStore = {}; // Simple in-memory session for demo

app.get('/', (req, res) => {
  res.send('Welcome to the Neto OAuth App');
});

// Step 1: Redirect to Neto Auth Page
app.get('/auth', (req, res) => {
  const { store_domain } = req.query;
  if (!store_domain) return res.status(400).send('Missing store_domain');

  const state = crypto.randomBytes(16).toString('hex');
  sessionStore[state] = { store_domain }; // Save state and store domain

  const authUrl = `https://api.netodev.com/oauth/v2/auth?version=2&client_id=${process.env.NETO_CLIENT_ID}&redirect_uri=${process.env.REDIRECT_URI}&response_type=code&store_domain=${store_domain}&state=${state}`;
  res.redirect(authUrl);
});

// Step 2: Handle Callback with Code
app.get('/neto/callback', async (req, res) => {
  const { code, state } = req.query;
  const session = sessionStore[state];

  console.log("CODE: ", code)
  if (!session || !code) {
    return res.status(400).send('Invalid state or missing code');
  }

  try {
    const tokenData = await exchangeToken({
      code,
      redirect_uri: process.env.REDIRECT_URI,
    });

    // Save token in session store (or DB in production)
    sessionStore[state].token = tokenData;

    res.send(`
      <h2>OAuth Successful!</h2>
      <p>Access Token: ${tokenData.access_token}</p>
      <p>Token Data: ${tokenData}</p>
      <a href="/get-items?state=${state}">Get Items from Neto</a>
    `);
  } catch (err) {
    console.error('Token exchange failed', err.message);
    res.status(500).send('OAuth failed');
  }
});

// Step 3: Make Authenticated Request to Neto
app.get('/get-items', async (req, res) => {
  const { state } = req.query;
  const session = sessionStore[state];
  console.log("Session Data", session)

  if (!session || !session.token) return res.status(403).send('Session not found or not authenticated');

  try {
    const data = await getNetoData(session.token);
    res.json(data);
  } catch (err) {
    console.error('API Request Failed:', err.message);
    res.status(500).send('Neto API request failed');
  }
});

app.listen(port, () => {
  console.log(`App listening at http://localhost:${port}`);
  console.log(`Start auth at http://localhost:300/auth/store_domain={provide domain without http}`)
});