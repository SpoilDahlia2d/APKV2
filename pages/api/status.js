// In-memory state (Note: On Vercel, this resets when the function sleeps. For production, connect a DB like Vercel KV)
global.popupConfig = global.popupConfig || {
  active: false,
  images: [
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcGpmam45Z2c0bW9pYWdxcHFyZ2N5anR4YWQ4cW1qaWp1bmVsdTN5ZSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/LpwBqCorPvZC0/giphy.gif"
  ],
  intervalMs: 1000
};

export default function handler(req, res) {
  res.status(200).json(global.popupConfig);
}
