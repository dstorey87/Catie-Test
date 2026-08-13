// Theory Trainer — simplified UK road-sign illustrations (educational recreations, not official artwork)
(function(){
const S = {};
const tri = (inner) => `<svg viewBox="0 0 120 120"><path d="M60 8 L114 104 L6 104 Z" fill="#fff" stroke="#D62F2F" stroke-width="9" stroke-linejoin="round"/>${inner}</svg>`;
const circ = (inner) => `<svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="54" fill="#fff" stroke="#D62F2F" stroke-width="10"/>${inner}</svg>`;
S.stop = `<svg viewBox="0 0 120 120"><polygon points="38,6 82,6 114,38 114,82 82,114 38,114 6,82 6,38" fill="#C22A2A" stroke="#fff" stroke-width="5"/><text x="60" y="72" text-anchor="middle" font-family="Arial,sans-serif" font-weight="bold" font-size="30" fill="#fff">STOP</text></svg>`;
S.giveWay = `<svg viewBox="0 0 120 120"><path d="M8 14 L112 14 L60 108 Z" fill="#fff" stroke="#D62F2F" stroke-width="10" stroke-linejoin="round"/><text x="60" y="42" text-anchor="middle" font-family="Arial,sans-serif" font-weight="bold" font-size="15" fill="#111">GIVE</text><text x="60" y="60" text-anchor="middle" font-family="Arial,sans-serif" font-weight="bold" font-size="15" fill="#111">WAY</text></svg>`;
S.speed30 = circ(`<text x="60" y="76" text-anchor="middle" font-family="Arial,sans-serif" font-weight="bold" font-size="44" fill="#111">30</text>`);
S.speed20 = circ(`<text x="60" y="76" text-anchor="middle" font-family="Arial,sans-serif" font-weight="bold" font-size="44" fill="#111">20</text>`);
S.natLimit = `<svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="54" fill="#fff" stroke="#9AA0A6" stroke-width="4"/><rect x="52" y="-14" width="16" height="148" fill="#111" transform="rotate(45 60 60)"/></svg>`;
S.minSpeed = `<svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="56" fill="#1663B0"/><text x="60" y="76" text-anchor="middle" font-family="Arial,sans-serif" font-weight="bold" font-size="44" fill="#fff">30</text></svg>`;
S.noEntry = `<svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="56" fill="#C22A2A"/><rect x="20" y="50" width="80" height="20" rx="3" fill="#fff"/></svg>`;
const car = (x,y,c)=>`<g transform="translate(${x} ${y})"><path d="M2 16 Q6 6 16 6 L24 6 Q32 6 36 14 L38 16 L38 24 L2 24 Z" fill="${c}"/><circle cx="10" cy="25" r="5" fill="${c}"/><circle cx="30" cy="25" r="5" fill="${c}"/></g>`;
S.noOvertaking = circ(car(14,38,'#C22A2A') + car(66,38,'#111'));
S.roadNarrows = tri(`<path d="M44 96 L52 44 M76 96 L68 44" stroke="#111" stroke-width="7" fill="none"/>`);
S.schoolAhead = tri(`<g fill="#111"><circle cx="48" cy="48" r="7"/><path d="M40 58 L56 58 L58 84 L52 84 L50 66 L46 84 L40 84 Z"/><circle cx="72" cy="54" r="6"/><path d="M65 63 L79 63 L80 88 L75 88 L74 72 L70 88 L65 88 Z"/></g>`);
S.slippery = tri(`<g transform="translate(36 50) rotate(-12)">${car(0,0,'#111')}</g><path d="M34 90 q8 -8 16 0 q8 8 16 0 M70 92 q8 -8 16 0" stroke="#111" stroke-width="5" fill="none"/>`);
S.bendLeft = tri(`<path d="M74 92 L74 66 Q74 54 62 54 L48 54" stroke="#111" stroke-width="9" fill="none"/><path d="M56 40 L38 54 L56 68 Z" fill="#111"/>`);
S.trafficLights = `<svg viewBox="0 0 120 120"><rect x="38" y="8" width="44" height="104" rx="8" fill="#2B2B2B"/><circle cx="60" cy="30" r="12" fill="#E23B3B"/><circle cx="60" cy="60" r="12" fill="#F2A93B"/><circle cx="60" cy="90" r="12" fill="#37B34A"/></svg>`;
S.redX = `<svg viewBox="0 0 120 120"><rect x="10" y="22" width="100" height="76" rx="8" fill="#111"/><path d="M35 42 L85 78 M85 42 L35 78" stroke="#E23B3B" stroke-width="10" stroke-linecap="round"/></svg>`;
S.boxJunction = `<svg viewBox="0 0 120 120"><rect x="8" y="8" width="104" height="104" fill="#3D3D3D"/><rect x="14" y="14" width="92" height="92" fill="none" stroke="#F5C518" stroke-width="5"/><path d="M14 14 L106 106 M106 14 L14 106 M60 14 L14 60 M60 14 L106 60 M14 60 L60 106 M106 60 L60 106" stroke="#F5C518" stroke-width="4"/></svg>`;
S.doubleWhite = `<svg viewBox="0 0 120 120"><rect x="8" y="8" width="104" height="104" fill="#3D3D3D"/><rect x="52" y="8" width="6" height="104" fill="#fff"/><rect x="62" y="8" width="6" height="104" fill="#fff"/></svg>`;
S.zebra = `<svg viewBox="0 0 120 120"><rect x="8" y="34" width="104" height="60" fill="#3D3D3D"/><g fill="#fff"><rect x="14" y="34" width="14" height="60"/><rect x="40" y="34" width="14" height="60"/><rect x="66" y="34" width="14" height="60"/><rect x="92" y="34" width="14" height="60"/></g><rect x="12" y="6" width="5" height="28" fill="#555"/><circle cx="14.5" cy="8" r="7" fill="#F2A93B"/></svg>`;
S.levelCrossing = tri(`<g stroke="#111" stroke-width="5" fill="none"><path d="M36 92 L36 56 M56 92 L56 56 M76 92 L76 56 M28 64 L84 64 M28 80 L84 80"/></g>`);
S.motorway = `<svg viewBox="0 0 120 120"><rect x="8" y="20" width="104" height="80" rx="10" fill="#1663B0"/><g fill="#fff"><rect x="42" y="34" width="7" height="52" transform="skewX(-8)" /><rect x="76" y="34" width="7" height="52" transform="skewX(8)"/><path d="M28 46 L92 46 L96 56 L24 56 Z"/></g></svg>`;
S.oneWay = `<svg viewBox="0 0 120 120"><rect x="20" y="8" width="80" height="104" rx="8" fill="#1663B0"/><path d="M60 22 L78 48 L66 48 L66 76 L54 76 L54 48 L42 48 Z" fill="#fff"/><text x="60" y="98" text-anchor="middle" font-family="Arial,sans-serif" font-weight="bold" font-size="14" fill="#fff">ONE WAY</text></svg>`;
window.SignImage = function(props){
  const svg = S[props.hint];
  if(!svg) return null;
  const size = props.size || 120;
  return React.createElement('div', {style:{width:size, height:size, flex:'none', filter:'drop-shadow(0 2px 4px rgba(0,0,0,.12))'}, 'aria-label':'sign illustration', dangerouslySetInnerHTML:{__html:svg}});
};
window.__signKeys = Object.keys(S);
})();
