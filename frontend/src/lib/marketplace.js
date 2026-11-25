export const GAME_ORDER = Object.freeze(['MLBB', 'FREE_FIRE', 'ROBLOX', 'GENSHIN']);

export const GAME_LABELS = Object.freeze({
  MLBB: 'MLBB',
  ROBLOX: 'Roblox',
  FREE_FIRE: 'Free Fire',
  GENSHIN: 'Genshin Impact',
});

export const GAME_NAMES = Object.freeze({
  MLBB: 'Mobile Legends',
  ROBLOX: 'Roblox',
  FREE_FIRE: 'Free Fire',
  GENSHIN: 'Genshin Impact',
  OTHER: 'Lainnya'
});

// Canonical source for original game marks referenced by the supplied Itemku ZIP.
export const GAME_ART = Object.freeze({
  MLBB: 'https://d1x91p7vw3vuq8.cloudfront.net/game/2024109/rcks2r0xntbibkh7gf72p.png',
  ROBLOX: 'https://d1x91p7vw3vuq8.cloudfront.net/game/2025124/vhyvvmjoekra0kyu3a2af4.svg',
  FREE_FIRE: 'https://d1x91p7vw3vuq8.cloudfront.net/game/2024711/93cu2pbsceeiior5v9yc2q.png',
  GENSHIN: 'https://d1x91p7vw3vuq8.cloudfront.net/game/2025118/z9t30wkd81lxiwmaio40v.webp',
});

// Local artwork is used as a full-bleed background; GAME_ART stays the crisp foreground mark.
export const GAME_BACKGROUNDS = Object.freeze({
  MLBB: '/assets/03-categories/category-mlbb.png',
  ROBLOX: '/assets/03-categories/category-roblox.png',
  FREE_FIRE: '/assets/03-categories/category-free-fire.png',
  GENSHIN: '/assets/03-categories/category-genshin.png',
  OTHER: '/assets/03-categories/category-other.png'
});
