import { VercelRequest, VercelResponse } from '@vercel/node';

export default (req: VercelRequest, res: VercelResponse) => {
  console.log("Cron executed at:", new Date());
  res.status(200).send('Cron job executed successfully.');
};
