// Asl dizayndagi rippleFx(event) funksiyasining React versiyasi.
// .ripple klassidagi elementlarga material-style bosish effekti qo'shadi.
export function rippleFx(e) {
  const el = e.currentTarget;
  const rect = el.getBoundingClientRect();
  const circle = document.createElement('span');
  const size = Math.max(rect.width, rect.height);
  circle.className = 'ripple-circle';
  circle.style.width = circle.style.height = size + 'px';
  circle.style.left = (e.clientX - rect.left - size / 2) + 'px';
  circle.style.top = (e.clientY - rect.top - size / 2) + 'px';
  el.appendChild(circle);
  setTimeout(() => circle.remove(), 550);
}
