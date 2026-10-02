import s from './site.module.css';

// Real YOYO GEMS stones (the category cut-outs from public/reference) arranged
// beside the home-page headline. Decorative: the headline carries the meaning.
const STONES = [
  { file: 'moissanite', x: 50, y: 48, size: 64, delay: 0 },
  { file: 'ruby-synthetic', x: 17, y: 20, size: 32, delay: 1.2 },
  { file: 'natural-emeralds', x: 83, y: 17, size: 24, delay: 2.4 },
  { file: 'nano', x: 15, y: 76, size: 30, delay: 0.6 },
  { file: 'synthetic-opals', x: 82, y: 78, size: 28, delay: 1.8 },
  { file: 'coloured-cz-stones', x: 94, y: 48, size: 17, delay: 3 },
  { file: 'glass-pearls', x: 47, y: 93, size: 15, delay: 2.1 }
];

export default function HeroStones() {
  return (
    <div className={s.heroStones} aria-hidden="true">
      <span className={s.heroRing} />
      {STONES.map((st, i) => (
        <img
          key={st.file}
          src={`/reference/categories/hd2/${st.file}.webp`}
          alt=""
          width={480}
          height={384}
          decoding="async"
          fetchPriority={i === 0 ? 'high' : undefined}
          className={s.heroStone}
          style={{ left: `${st.x}%`, top: `${st.y}%`, width: `${st.size}%`, animationDelay: `-${st.delay}s` }}
        />
      ))}
    </div>
  );
}
