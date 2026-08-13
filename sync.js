// Theory Trainer sync — GitHub adapter. One JSON snapshot stored in your repo via the Contents API. No Supabase, no SDK.
window.TTSync = (function(){
  let cfg = null, sha = null;
  try { cfg = JSON.parse(localStorage.getItem('theoryTrainer.sync')) || null; } catch(e) {}
  if(cfg && !cfg.repo) cfg = null; // discard old-format (Supabase) config
  const PATH = 'sync/data.json';
  const api = p => 'https://api.github.com/repos/' + cfg.repo + p;
  const hdr = () => ({Authorization: 'Bearer ' + cfg.token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28'});
  const enc = obj => { const u = new TextEncoder().encode(JSON.stringify(obj)); let s = ''; for(let i=0;i<u.length;i++) s += String.fromCharCode(u[i]); return btoa(s); };
  const dec = b64 => { const bin = atob(String(b64).replace(/\s/g,'')); const u = new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) u[i] = bin.charCodeAt(i); return JSON.parse(new TextDecoder().decode(u)); };
  const explain = st =>
    st===401 ? 'GitHub did not accept the token — check it was copied in full.' :
    st===403 ? 'The token is not allowed to do that — it needs Contents read & write on that repo.' :
    st===404 ? 'Repo not found — check the owner/name, and that the token can see it.' :
    'GitHub error ' + st;
  async function getFile(){
    const r = await fetch(api('/contents/' + PATH + '?ref=' + (cfg.branch || 'main')), {headers: hdr(), cache: 'no-store'});
    if(r.status === 404){ sha = null; return null; }
    if(!r.ok) throw new Error(explain(r.status));
    const d = await r.json();
    sha = d.sha;
    return {blob: dec(d.content), sha: d.sha};
  }
  return {
    configured: () => !!(cfg && cfg.repo && cfg.token),
    setConfig: (repo, token) => {
      cfg = {repo: String(repo).replace(/^https?:\/\/(www\.)?github\.com\//i,'').replace(/\.git$/,'').replace(/\/+$/,''), token: token, branch: cfg && cfg.branch || 'main'};
      sha = null;
      try { localStorage.setItem('theoryTrainer.sync', JSON.stringify(cfg)); } catch(e) {}
    },
    config: () => cfg,
    signOut: () => { cfg = null; sha = null; try { localStorage.removeItem('theoryTrainer.sync'); } catch(e) {} },
    test: async () => { // validates repo + token, learns the default branch
      const r = await fetch(api(''), {headers: hdr(), cache: 'no-store'});
      if(!r.ok) throw new Error(explain(r.status));
      const d = await r.json();
      cfg.branch = d.default_branch || 'main';
      try { localStorage.setItem('theoryTrainer.sync', JSON.stringify(cfg)); } catch(e) {}
      return true;
    },
    pull: getFile,
    push: async (blob) => {
      const body = () => JSON.stringify({message: 'Theory Trainer sync', content: enc(blob), branch: cfg.branch || 'main', sha: sha || undefined});
      const put = () => fetch(api('/contents/' + PATH), {method: 'PUT', headers: Object.assign(hdr(), {'Content-Type': 'application/json'}), body: body()});
      let r = await put();
      if(r.status === 409 || r.status === 422){ await getFile(); r = await put(); } // sha went stale — refetch once and retry
      if(!r.ok) throw new Error(explain(r.status));
      const d = await r.json();
      if(d.content) sha = d.content.sha;
      return true;
    }
  };
})();
