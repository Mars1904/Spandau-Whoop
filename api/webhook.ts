import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async (req: VercelRequest, res: VercelResponse) => {
  const webhookData = req.body;

  const whoopUserId = webhookData.user_id;

  // WHOOP-Daten in Supabase speichern
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('whoop_user_id', whoopUserId)
    .single();

  if (!user) {
    return res.status(400).send('User not found.');
  }

  // Daten speichern (Beispiel: daily_metrics Tabelle)
  const { error } = await supabase.from('daily_metrics').insert({
    user_id: user.id,
    recovery_score: webhookData.recovery?.score,
    sleep_duration: webhookData.sleep?.duration,
    strain: webhookData.strain?.score,
    hrv: webhookData.recovery?.hrv_rmssd,
    resting_hr: webhookData.recovery?.resting_heart_rate,
    date: webhookData.date
  });

  if (error) {
    console.error('Supabase insert error:', error);
    return res.status(500).send('Database insert error');
  }

  res.status(200).send('Webhook data saved successfully.');
};
