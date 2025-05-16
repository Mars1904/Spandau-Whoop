import { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';

const clientId = process.env.WHOOP_CLIENT_ID;
const clientSecret = process.env.WHOOP_CLIENT_SECRET;
const redirectUri = process.env.REDIRECT_URI;

export default async (req: VercelRequest, res: VercelResponse) => {
  const code = req.query.code as string;

  if (!code) {
    return res.status(400).send('Code is missing');
  }

  const response = await fetch('https://api.prod.whoop.com/oauth/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    return res.status(response.status).send('Token request failed');
  }

  const data = await response.json();

  // Testausgabe:
  res.status(200).json(data);
};
