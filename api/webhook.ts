import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async (req: VercelRequest, res: VercelResponse) => {
  const { user_id, recovery, sleep, strain, date } = req.body;

  const { data: user, error: userErr } = await supabase
    .from('users')
    .select('id')
    .eq('whoop_user_id', user_id)
    .single();

  if (userErr || !user) {
    return res.status(400).json({ error: 'User not found' });
  }

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
    return res.status(500).json({ error: 'Supabase insert error', details: error });
  }

  res.status(200).json({ success: true });
};
