import { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export default async (req: VercelRequest, res: VercelResponse) => {
  const code = req.query.code as string;
  if (!code) {
    return res.status(400).json({ error: 'Code missing' });
  }

  const response = await fetch('https://api.prod.whoop.com/oauth/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.WHOOP_CLIENT_ID!,
      client_secret: process.env.WHOOP_CLIENT_SECRET!,
      redirect_uri: process.env.REDIRECT_URI!,
      grant_type: 'authorization_code',
      code,
    }),
  });

  const responseData = await response.json();

  if (!response.ok) {
    console.error(responseData);
    return res.status(response.status).json({ error: 'Token request failed', details: responseData });
  }

  const { access_token, refresh_token, expires_in } = responseData;

  // Nutzer-Infos abfragen (WHOOP API)
  const userResponse = await fetch('https://api.prod.whoop.com/developer/v1/user/profile/basic', {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  const userProfile = await userResponse.json();

  // Nutzer speichern/aktualisieren in Supabase
  const { data, error } = await supabase.from('users').upsert({
    whoop_user_id: userProfile.user_id,
    email: userProfile.email,
    first_name: userProfile.first_name,
    last_name: userProfile.last_name,
    access_token,
    refresh_token,
    expires_at: new Date(Date.now() + expires_in * 1000).toISOString(),
  });

  if (error) {
    console.error('Supabase Fehler:', error);
    return res.status(500).json({ error: 'Supabase Fehler', details: error });
  }

  // Automatische Weiterleitung auf Dashboard
  res.redirect(`/frontend/dashboard.html?user=${userProfile.user_id}`);
};
