import { useNavigate } from 'react-router-dom';
import { rippleFx } from '../hooks/useRipple';

// chessmate.html'da mavjud bo'lmagan sahifalar (Profile/Stats/Theme/Friends)
// uchun bir xil topbar — bosh topbar bilan bir xil klass va uslub, faqat
// orqaga qaytish tugmasi qo'shilgan.
export default function DetailTopbar({ icon, title, subtitle }) {
  const navigate = useNavigate();

  return (
    <div className="topbar">
      <div className="topbar-title-wrap">
        <button className="icon-btn ripple back-btn" onClick={(e) => { rippleFx(e); navigate(-1); }}>
          <i className="fa-solid fa-chevron-left"></i>
        </button>
        {icon && <div className="topbar-icon"><i className={icon}></i></div>}
        <div>
          <div className="topbar-title">{title}</div>
          {subtitle && <div className="topbar-subtitle">{subtitle}</div>}
        </div>
      </div>
    </div>
  );
}
