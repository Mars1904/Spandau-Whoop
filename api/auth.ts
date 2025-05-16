import { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';

const clientId = process.env.WHOOP_CLIENT_ID!;
const clientSecret = process.env.WHOOP_CLIENT_SECRET!;
const redirectUri = process.env.REDIRECT_URI!;
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(supabaseUrl, supabaseKey);

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
    return res.status(response.status).send('Token request failed');
  }

  const data = await response.json();

  // Speichere WHOOP User ID mit Supabase User
  const userData = await fetch('https://api.prod.whoop.com/developer/v1/user/profile/basic', {
    headers: { Authorization: `Bearer ${data.access_token}` },
  });

  const userProfile = await userData.json();
  const whoop_user_id = userProfile.user_id;

  // Authentifiziere und erstelle User automatisch in Supabase
  let { data: user, error } = await supabase
    .from('users')
    .select('id')
    .eq('whoop_user_id', whoop_user_id)
    .single();

  if (!user) {
    const { data: newUser } = await supabase
      .from('users')
      .insert({ whoop_user_id })
      .select()
      .single();

    user = newUser;
  }

  // Generiere Supabase Auth Token für den Benutzer
  const token = supabase.auth.admin.createCustomToken(user.id);

  // Weiterleitung nach erfolgreichem Login auf die Profilseite (Sportler Dashboard)
  res.redirect(`/frontend/dashboard.html?token=${token}`);
};
