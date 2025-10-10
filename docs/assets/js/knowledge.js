/* knowledge.js — lightweight patch layer (2025-10-11)
   Drop-in file that can REPLACE your existing knowledge.js if it already renders content to .kh-content.
   What it guarantees:
   - Injects a mobile left-top sidebar toggle button mirroring the Random button.
   - Ensures the sidebar opens/closes by toggling [data-open] on .kh-sidenav.
   - Wraps each content section into a .section-card if not already wrapped.
   - Scrubs stray meta lines like '建立時間:' & '科目:' from content.
*/

(function(){
  const MQ_MOBILE = 820;

  function qs(sel, root=document){ return root.querySelector(sel); }
  function qsa(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }

  function ensureMobileButtons(){
    const isMobile = window.innerWidth <= MQ_MOBILE;
    const sidenav = qs('.kh-sidenav');
    if (!isMobile || !sidenav) return;

    // Sidebar toggle (left-top)
    let toggle = qs('.kh-sidenav__toggle');
    if (!toggle){
      toggle = document.createElement('button');
      toggle.className = 'kh-sidenav__toggle';
      toggle.id = 'btn-sidenav';
      toggle.type = 'button';
      toggle.textContent = '類別';
      document.body.appendChild(toggle);
    }
    toggle.onclick = () => {
      const open = sidenav.getAttribute('data-open') === 'true';
      sidenav.setAttribute('data-open', (!open).toString());
    };

    // Ensure sidebar starts closed on mobile
    if (sidenav.getAttribute('data-open') == null){
      sidenav.setAttribute('data-open','false');
    }
  }

  // Remove residual meta lines inside content
  function scrubMeta(root){
    const metaLine = /^(建立時間|科目)\s*[:：]/;
    qsa('p', root).forEach(p=>{
      const t=(p.textContent||'').trim();
      if (metaLine.test(t)) p.remove();
    });
  }

  // Wrap h2/h3 sections into cards (idempotent)
  function cardizeContent(){
    const host = qs('.kh-content');
    if (!host) return;
    const container = host; // assume cards are direct children or in a flow root
    scrubMeta(container);

    // Already cardized?
    if (qsa('.section-card', container).length > 0){
      return;
    }

    const nodes = Array.from(container.childNodes);
    const isHeading = el => el && el.nodeType===1 && /H2|H3/.test(el.tagName);
    let i=0; const frags=[];
    while(i<nodes.length){
      if (isHeading(nodes[i])){
        const title = (nodes[i].textContent||'內容').trim() || '內容';
        const wrapper = document.createElement('div');
        wrapper.className = 'section-card';
        const titleEl = document.createElement('div');
        titleEl.className = 'section-card__title';
        titleEl.textContent = title;
        const body = document.createElement('div');
        body.className = 'prose';

        i++; // skip heading
        while(i<nodes.length && !isHeading(nodes[i])){
          body.appendChild(nodes[i].cloneNode(true));
          i++;
        }
        wrapper.appendChild(titleEl);
        wrapper.appendChild(body);
        frags.push(wrapper);
        continue;
      }
      i++;
    }

    if (frags.length){
      container.innerHTML = '';
      frags.forEach(el=>container.appendChild(el));
    }
  }

  function init(){
    ensureMobileButtons();
    cardizeContent();

    // Re-run when content changes (e.g., after async render)
    const host = qs('.kh-content');
    if (!host) return;
    const mo = new MutationObserver(()=>{
      ensureMobileButtons();
      cardizeContent();
    });
    mo.observe(host, { childList:true, subtree:true });
    window.addEventListener('resize', ensureMobileButtons);
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  }else{
    init();
  }
})();
