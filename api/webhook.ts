import { VercelRequest, VercelResponse } from '@vercel/node';

export default (req: VercelRequest, res: VercelResponse) => {
  console.log("Webhook Data Received:", req.body);
  res.status(200).send('Webhook received successfully.');
};
