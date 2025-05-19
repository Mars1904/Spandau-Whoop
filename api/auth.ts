import { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

// Stelle sicher, dass Umgebungsvariablen vorhanden sind
const WHOOP_CLIENT_ID = process.env.WHOOP_CLIENT_ID || '';
const WHOOP_CLIENT_SECRET = process.env.WHOOP_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.REDIRECT_URI || '';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Debug-Ausgabe für die Umgebungsvariablen
console.log('WHOOP_CLIENT_ID vorhanden:', !!WHOOP_CLIENT_ID);
console.log('WHOOP_CLIENT_SECRET vorhanden:', !!WHOOP_CLIENT_SECRET);
console.log('REDIRECT_URI:', REDIRECT_URI);
console.log('SUPABASE_URL vorhanden:', !!SUPABASE_URL);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export default async (req: VercelRequest, res: VercelResponse) => {
  console.log('Auth-Endpoint aufgerufen mit Query:', req.query);
  
  const code = req.query.code as string;
  const state = req.query.state as string;

  if (!code) {
    // Prüfe, ob state fehlt oder zu kurz ist
    if (!state || state.length < 8) {
      return res.status(400).send(`
        <html>
          <body style='font-family:sans-serif;max-width:600px;margin:40px auto;'>
            <h2>Fehler: Der state-Parameter ist zu kurz oder fehlt.</h2>
            <p>Bitte starte den Login erneut über die Startseite.</p>
            <p style='color:#888;font-size:0.9em;'>Tipp: Seite neu laden oder Browser-Cache leeren.</p>
          </body>
        </html>
      `);
    }
    // Nur wenn state gültig ist, weiterleiten
    const loginUrl = `https://api.prod.whoop.com/oauth/oauth2/auth?client_id=${WHOOP_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&state=${state}`;
    return res.redirect(loginUrl);
  }

  try {
    console.log('Token-Anfrage an WHOOP wird gesendet...');
    const response = await fetch('https://api.prod.whoop.com/oauth/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: WHOOP_CLIENT_ID,
        client_secret: WHOOP_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
        code,
      }),
    });

    const responseData = await response.json();
    console.log('WHOOP Token-Antwort Status:', response.status);

    if (!response.ok) {
      console.error('WHOOP Fehler:', responseData);
      return res.status(400).json(responseData);
    }

    console.log('Token erhalten, rufe Nutzerprofil ab...');
    const userResponse = await fetch('https://api.prod.whoop.com/developer/v1/user/profile/basic', {
      headers: { Authorization: `Bearer ${responseData.access_token}` },
    });
    
    if (!userResponse.ok) {
      console.error('Fehler beim Abrufen des Nutzerprofils:', await userResponse.text());
      return res.status(400).json({ error: 'Failed to fetch user profile' });
    }
    
    const userProfile = await userResponse.json();
    console.log('Nutzerprofil erhalten:', JSON.stringify(userProfile));

    // Speichere Daten in Supabase - nutze upsert mit primärem Schlüssel whoop_user_id
    const { data: upsertData, error: upsertError } = await supabase
      .from('users')
      .upsert({
        whoop_user_id: userProfile.user_id,
        first_name: userProfile.first_name,
        last_name: userProfile.last_name,
        email: userProfile.email || null,
        profile_pic: userProfile.profile_picture || null,
        whoop_access_token: responseData.access_token,
        whoop_refresh_token: responseData.refresh_token,
        whoop_token_expires_at: new Date(Date.now() + responseData.expires_in * 1000).toISOString(),
      })
      .select();

    if (upsertError) {
      console.error('Supabase Fehler beim Speichern des Benutzers:', upsertError);
      return res.status(500).json({ error: 'Database error', details: upsertError });
    }

    console.log('Benutzer in Datenbank gespeichert:', upsertData);
    
    // Optional: Erstelle einen Testdatensatz für den Benutzer, falls noch keine Daten vorhanden sind
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('whoop_user_id', userProfile.user_id)
      .single();
      
    if (user) {
      console.log('Prüfe auf vorhandene Metriken...');
      const { data: existingMetrics } = await supabase
        .from('daily_metrics')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);
        
      if (!existingMetrics || existingMetrics.length === 0) {
        console.log('Keine Metriken gefunden, erstelle Testdaten...');
        // Erstelle einen Beispieldatensatz für heute
        const today = new Date().toISOString().split('T')[0];
        await supabase.from('daily_metrics').insert({
          user_id: user.id,
          recovery_score: 85,
          sleep_duration: 7.5,
          strain: 12.3,
          hrv: 58,
          resting_hr: 62,
          date: today
        });
        console.log('Testdaten erstellt');
      }
    }

    // Leite zum Dashboard weiter
    console.log('Weiterleitung zum Dashboard...');
    res.redirect('/frontend/dashboard.html');
  } catch (error) {
    console.error('Unerwarteter Fehler:', error);
    res.status(500).json({ error: 'Internal server error', details: error });
  }
};