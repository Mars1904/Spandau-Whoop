import { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';

const clientId = process.env.WHOOP_CLIENT_ID!;
const clientSecret = process.env.WHOOP_CLIENT_SECRET!;
const redirectUri = process.env.REDIRECT_URI!;

export default async (req: VercelRequest, res: VercelResponse) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ error: 'Code missing' });
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

  const responseText = await response.text();

  if (!response.ok) {
    console.error('WHOOP-API Fehler:', responseText);
    // hier ist die wichtige Änderung, um Details im Browser zu sehen:
    return res.status(response.status).json({
      error: 'Token request failed',
      details: responseText // Wichtige Fehlerdetails
    });
  }

  const data = JSON.parse(responseText);
  res.status(200).json(data);
};
