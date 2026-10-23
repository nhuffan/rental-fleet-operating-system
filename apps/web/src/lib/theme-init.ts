// Runs synchronously in <head>, before any content can paint. Only a local,
// allowlisted preference is read; no account/business setting is changed.
export const themeInitScript = `(function(){var t;try{t=localStorage.getItem('rental-fleet-theme')}catch(e){}var d=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light'})()`;
