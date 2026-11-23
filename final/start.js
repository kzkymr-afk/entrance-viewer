const el = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const walk = params.get('mode') === 'walk';
const scheme = el('scheme'), view = el('view');
for (const select of [scheme, view]) {
  const value = params.get(select.id);
  if ([...select.options].some(option => option.value === value)) select.value = value;
}
el('travel').onclick = () => {
  const url = new URL(location.href);
  url.searchParams.set('scheme', scheme.value);
  url.searchParams.set('view', view.value);
  if (walk) url.searchParams.delete('mode');
  else url.searchParams.set('mode', 'walk');
  location.assign(url);
};
if (walk) {
  el('travel').textContent = '軽量360°に戻る';
  el('hint').textContent = 'ドラッグで見回す · WASD／矢印で移動';
  el('pad').hidden = false;
  await import('./viewer.js?v=24');
} else {
  await import('./panorama.js?v=24');
}
