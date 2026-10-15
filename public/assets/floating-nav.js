(function(){'use strict';
const path=location.pathname.toLowerCase();
const active=path.endsWith('/dashboard.html')?'dashboard':path.endsWith('/penilaian.html')?'room':'leaderboard';
const icons={
 dashboard:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
 room:'<path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8"/><path d="m9 12 3 3L21 6"/>',
 leaderboard:'<path d="M3 21h18M6 21v-7h4v7M10 21V7h4v14M14 21v-11h4v11"/>'
};
const items=[['dashboard','dashboard.html','Dashboard'],['room','penilaian.html','Penilaian'],['leaderboard','./','Leaderboard']];
const nav=document.createElement('nav');nav.className='float-bottom-nav';nav.setAttribute('aria-label','Navigasi utama');
nav.innerHTML=items.map(([id,href,label])=>'<a href="'+href+'"'+(id===active?' aria-current="page"':'')+'><svg viewBox="0 0 24 24" aria-hidden="true">'+icons[id]+'</svg><span>'+label+'</span></a>').join('');
document.body.appendChild(nav);
})();