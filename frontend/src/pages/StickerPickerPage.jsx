import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTelegram } from '../hooks/useTelegram';
import { BACKEND } from '../hooks/useGame';
import { rippleFx } from '../hooks/useRipple';
import DetailTopbar from '../components/DetailTopbar';
import { STICKERS, STICKER_CATEGORIES, stickerUrl } from '../data/stickers';

export default function StickerPickerPage() {
  const navigate = useNavigate();
  const { user } = useTelegram();
  const [profile, setProfile] = useState(null);
  const [activeCategory, setActiveCategory] = useState('chess');
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetch(`${BACKEND}/api/users/${user.id}`)
      .then(r => r.json())
      .then(p => { setProfile(p); setSelected(p.profile_sticker || null); })
      .catch(() => {});
  }, [user]);

  async function chooseSticker(id) {
    if (!user || saving) return;
    const next = selected === id ? null : id; // Bir xilini bosilsa — olib tashlanadi
    setSelected(next);
    setSaving(true);
    try {
      await fetch(`${BACKEND}/api/users/${user.id}/sticker`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stickerId: next })
      });
    } catch {
      // Xato bo'lsa oldingi holatga qaytarish shart emas — foydalanuvchi qayta urinishi mumkin
    } finally {
      setSaving(false);
    }
  }

  const itemsInCategory = STICKERS.filter(s => s.category === activeCategory);

  return (
    <div className="page active">
      <DetailTopbar icon="fa-solid fa-icons" title="Profile Sticker" subtitle="Choose one to display on your profile" />

      {/* Joriy tanlangan sticker preview */}
      <div className="detail-card" style={{ padding: '20px', textAlign: 'center', marginBottom: '20px' }}>
        <div style={{
          width: '72px', height: '72px', margin: '0 auto 10px auto',
          borderRadius: '50%', background: 'var(--accent-soft)',
          border: '2px solid var(--accent)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
        }}>
          {selected ? (
            <img src={stickerUrl(selected)} alt="Selected sticker" style={{ width: '46px', height: '46px' }} />
          ) : (
            <i className="fa-regular fa-circle-question" style={{ fontSize: '24px', color: 'var(--text-tertiary)' }}></i>
          )}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>
          {selected ? (STICKERS.find(s => s.id === selected)?.label || 'Selected') : 'No sticker selected'}
        </div>
      </div>

      {/* Kategoriya tab'lari */}
      <div className="filter-tabs">
        {STICKER_CATEGORIES.map(cat => (
          <button
            key={cat.id}
            className={`filter-tab ripple${activeCategory === cat.id ? ' active' : ''}`}
            onClick={(e) => { rippleFx(e); setActiveCategory(cat.id); }}
          >
            <i className={cat.icon}></i>
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {/* Shu kategoriyadagi stikerlar grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))',
        gap: '10px', marginBottom: '20px'
      }}>
        {itemsInCategory.map(sticker => {
          const isSelected = selected === sticker.id;
          return (
            <button
              key={sticker.id}
              onClick={(e) => { rippleFx(e); chooseSticker(sticker.id); }}
              className="ripple"
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: '6px', padding: '10px 6px', borderRadius: '14px',
                background: isSelected ? 'var(--accent-soft)' : 'var(--card)',
                border: `1.5px solid ${isSelected ? 'var(--accent)' : 'var(--card-border)'}`,
                cursor: 'pointer', transition: 'all 0.2s'
              }}
            >
              <img src={stickerUrl(sticker.id)} alt={sticker.label} style={{ width: '32px', height: '32px' }} loading="lazy" />
              <span style={{
                fontSize: '10px', fontWeight: 600, textAlign: 'center',
                color: isSelected ? 'var(--accent)' : 'var(--text-secondary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%'
              }}>
                {sticker.label}
              </span>
              {isSelected && (
                <i className="fa-solid fa-circle-check" style={{ position: 'absolute', marginTop: '-38px', marginLeft: '46px', fontSize: '13px', color: 'var(--accent)', background: 'var(--bg)', borderRadius: '50%' }}></i>
              )}
            </button>
          );
        })}
      </div>

      {selected && (
        <button
          onClick={(e) => { rippleFx(e); chooseSticker(selected); }}
          className="btn-secondary ripple"
          style={{ width: '100%' }}
        >
          <i className="fa-solid fa-xmark"></i> Remove Sticker
        </button>
      )}
    </div>
  );
}
