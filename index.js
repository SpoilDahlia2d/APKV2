import { useEffect, useState } from 'react';

export default function Dashboard() {
  const [config, setConfig] = useState(null);
  const [newImage, setNewImage] = useState('');

  const fetchStatus = async () => {
    const res = await fetch('/api/status');
    const data = await res.json();
    setConfig(data);
  };

  useEffect(() => {
    fetchStatus();
    const int = setInterval(fetchStatus, 3000);
    return () => clearInterval(int);
  }, []);

  const updateConfig = async (updates) => {
    await fetch('/api/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    fetchStatus();
  };

  const toggleSpam = () => {
    updateConfig({ active: !config.active });
  };

  const addImage = () => {
    if (!newImage) return;
    updateConfig({ images: [...config.images, newImage] });
    setNewImage('');
  };

  const removeImage = (index) => {
    const newImages = [...config.images];
    newImages.splice(index, 1);
    updateConfig({ images: newImages });
  };

  if (!config) return <div style={{padding: 20, color:'white'}}>Loading Dashboard...</div>;

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto', background: '#111', color: 'white', minHeight: '100vh'}}>
      <h1 style={{color: '#ff3366', borderBottom: '1px solid #333', paddingBottom: 10}}>🦠 Tether App - Spammer Dashboard</h1>
      
      <div style={{ background: '#222', padding: 20, borderRadius: 10, marginTop: 20 }}>
        <h2>Status Attacco: {config.active ? <span style={{color: '#00ff00'}}>ATTIVO AL BERSAGLIO IN CORSO</span> : <span style={{color: '#ff3333'}}>DISATTIVATO</span>}</h2>
        <button 
          onClick={toggleSpam} 
          style={{ width: '100%', padding: '15px', fontSize: '18px', background: config.active ? '#ff3333' : '#00cc00', color: 'white', border: 'none', cursor: 'pointer', borderRadius: 5, fontWeight: 'bold' }}>
          {config.active ? '🛑 FERMA SPAM' : '☢️ INIZIA SPAM IMMAGINI'}
        </button>
      </div>

      <div style={{ background: '#222', padding: 20, borderRadius: 10, marginTop: 20 }}>
        <h3>Impostazioni Spam</h3>
        <label>Intervallo generazione (ms): </label>
        <input 
          type="number" 
          value={config.intervalMs} 
          onChange={(e) => updateConfig({intervalMs: parseInt(e.target.value)})} 
          style={{padding: 5, width: 100}}
        />
        <p style={{fontSize: 12, color: '#aaa'}}>Un numero basso (es. 200) genererà 5 immagini al secondo. Usa con cautela!</p>
      </div>

      <div style={{ background: '#222', padding: 20, borderRadius: 10, marginTop: 20 }}>
        <h3>Immagini Pop-up URL</h3>
        <div style={{display: 'flex', gap: 10, marginBottom: 20}}>
          <input 
            type="text" 
            placeholder="Incolla link immagine (es. da imgur o tenor)" 
            value={newImage}
            onChange={(e) => setNewImage(e.target.value)}
            style={{flex: 1, padding: 10, background: '#333', color: 'white', border: '1px solid #444'}}
          />
          <button onClick={addImage} style={{padding: '10px 20px', background: '#00cc00', color: 'white', border: 'none', cursor:'pointer'}}>Aggiungi</button>
        </div>

        <div style={{display: 'flex', flexWrap: 'wrap', gap: 10}}>
          {config.images.map((img, i) => (
            <div key={i} style={{position: 'relative', width: '150px', height: '150px', background: '#333'}}>
              <img src={img} alt="spam" style={{width: '100%', height: '100%', objectFit: 'cover'}} />
              <button 
                onClick={() => removeImage(i)}
                style={{position: 'absolute', top: 5, right: 5, background: 'red', color: 'white', border: 'none', cursor:'pointer', padding: '2px 5px'}}>
                X
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
