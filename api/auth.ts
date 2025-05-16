import { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';

const clientId = process.env.WHOOP_CLIENT_ID!;
const clientSecret = process.env.WHOOP_CLIENT_SECRET!;
const redirectUri = process.env.REDIRECT_URI!;

export default async (req: VercelRequest, res: VercelResponse) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send('Code missing');
  }

  const response = await fetch('https://api.prod.whoop.com/oauth/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code: code as string,
    }),
  });

  if (!response.ok) {
    const errorDetails = await response.json();
    console.error('WHOOP API Fehler:', errorDetails);
    return res.status(response.status).send('Token request failed: ' + JSON.stringify(errorDetails));
  }

  const data = await response.json();
  res.status(200).json(data);
};
