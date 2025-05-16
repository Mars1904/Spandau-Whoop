import { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';

export default async (req: VercelRequest, res: VercelResponse) => {
  const { code } = req.query;
  const { WHOOP_CLIENT_ID, WHOOP_CLIENT_SECRET, REDIRECT_URI } = process.env;

  if (!code) {
    return res.status(400).send('Code missing');
  }

  const response = await fetch('https://api.prod.whoop.com/oauth/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: WHOOP_CLIENT_ID!,
      client_secret: WHOOP_CLIENT_SECRET!,
      redirect_uri: REDIRECT_URI!,
      grant_type: 'authorization_code',
      code: code as string,
    }),
  });

  const data = await response.json();
  res.status(response.status).json(data);
};
