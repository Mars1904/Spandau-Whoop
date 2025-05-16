import { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

const WHOOP_CLIENT_ID = process.env.WHOOP_CLIENT_ID;
const WHOOP_CLIENT_SECRET = process.env.WHOOP_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export default async (req: VercelRequest, res: VercelResponse) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send('Code missing');
  }

  try {
    const response = await fetch('https://api.prod.whoop.com/oauth/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: WHOOP_CLIENT_ID,
        client_secret: WHOOP_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
        code: code as string,
      }),
    });

    if (!response.ok) {
      const errorDetails = await response.text();
      console.error('WHOOP token request failed:', errorDetails);
      return res.status(response.status).send('WHOOP Token request failed');
    }

    const data = await response.json();

    // WHOOP user details abrufen
    const userDetails = await fetch('https://api.prod.whoop.com/developer/v1/user/profile/basic', {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });

    const userProfile = await userDetails.json();

    // Nutzer in Supabase speichern
    const { error: supabaseError } = await supabase
      .from('users')
      .upsert({
        whoop_user_id: userProfile.user_id,
        first_name: userProfile.first_name,
        last_name: userProfile.last_name,
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
      });

    if (supabaseError) {
      console.error('Supabase error:', supabaseError);
      return res.status(500).send('Supabase storage failed');
    }

    // Weiterleitung zur Dashboard-Seite
    res.redirect('/frontend/dashboard.html');

  } catch (error) {
    console.error('General error:', error);
    res.status(500).send('Internal Server Error');
  }
};
