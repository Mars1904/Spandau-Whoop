import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Umgebungsvariablen mit Default-Werten für TypeScript
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export default async (req: VercelRequest, res: VercelResponse) => {
  console.log('Webhook aufgerufen mit Daten:', JSON.stringify(req.body));
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // Prüfe, ob die erforderlichen Daten vorhanden sind
  const { user_id, recovery, sleep, strain, date } = req.body;
  if (!user_id || !recovery || !sleep || !strain || !date) {
    console.error('Fehlende Daten in Webhook-Anfrage:', req.body);
    return res.status(400).json({ error: 'Missing required data' });
  }

  try {
    // Suche den Benutzer in der Datenbank
    console.log('Suche Benutzer mit WHOOP ID:', user_id);
    const { data: user, error: userErr } = await supabase
      .from('users')
      .select('id')
      .eq('whoop_user_id', user_id)
      .single();

    if (userErr || !user) {
      console.error('Benutzer nicht gefunden oder Datenbankfehler:', userErr);
      return res.status(400).json({ error: 'User not found', details: userErr });
    }

    console.log('Benutzer gefunden:', user);
    
    // Prüfe, ob bereits Daten für diesen Tag existieren
    const { data: existingData } = await supabase
      .from('daily_metrics')
      .select('id')
      .eq('user_id', user.id)
      .eq('date', date)
      .single();
      
    if (existingData) {
      console.log('Aktualisiere vorhandene Metrik für Datum:', date);
      const { error: updateError } = await supabase
        .from('daily_metrics')
        .update({
          recovery_score: recovery.score,
          sleep_duration: sleep.duration,
          strain: strain.score,
          hrv: recovery.hrv_rmssd,
          resting_hr: recovery.resting_heart_rate,
        })
        .eq('id', existingData.id);
        
      if (updateError) {
        console.error('Fehler beim Aktualisieren der Metrik:', updateError);
        return res.status(500).json({ error: 'Supabase update error', details: updateError });
      }
    } else {
      console.log('Erstelle neue Metrik für Datum:', date);
      const { error } = await supabase.from('daily_metrics').insert({
        user_id: user.id,
        recovery_score: recovery.score,
        sleep_duration: sleep.duration,
        strain: strain.score,
        hrv: recovery.hrv_rmssd,
        resting_hr: recovery.resting_heart_rate,
        date
      });

      if (error) {
        console.error('Fehler beim Einfügen der Metrik:', error);
        return res.status(500).json({ error: 'Supabase insert error', details: error });
      }
    }

    console.log('Metrik erfolgreich gespeichert/aktualisiert');
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Unerwarteter Fehler im Webhook:', error);
    res.status(500).json({ error: 'Internal server error', details: error });
  }
};
