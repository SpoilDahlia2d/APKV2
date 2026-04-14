export default function handler(req, res) {
  if (req.method === 'POST') {
    const { active, images, intervalMs } = req.body;
    
    if (typeof active !== 'undefined') global.popupConfig.active = active;
    if (images) global.popupConfig.images = images;
    if (intervalMs) global.popupConfig.intervalMs = intervalMs;
    
    return res.status(200).json({ success: true, config: global.popupConfig });
  }
  
  res.status(405).json({ error: 'Method not allowed' });
}
