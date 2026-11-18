// Precaricato da tutte le prove (node -r prove/finto-db.js …; lo fa da solo prove/tutte.js): le chiamate al database VERO del sito non partono mai.
// Rispondono 204 dal browser di prova, così le prove non gonfiano i contatori veri e non lasciano errori in console.
// Le prove che vogliono guardare le chiamate aggiungono dopo la loro regola, che ha la precedenza.
const pw = require('playwright');
const lancia = pw.chromium.launch.bind(pw.chromium);
pw.chromium.launch = async (...a) => {
  const b = await lancia(...a);
  const nuovo = b.newContext.bind(b);
  b.newContext = async (...x) => {
    const c = await nuovo(...x);
    await c.route(/^https:\/\/[a-z0-9-]+\.supabase\.co\//, (r) => r.fulfill({ status: 204, body: '' }));
    return c;
  };
  return b;
};
