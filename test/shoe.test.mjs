// Sens de la chaussure sur la photo détourée : bout à gauche (> 0) ou à droite (< 0)
import sharp from 'sharp';
import { toeSide } from '../scripts/shoe-side.mjs';

// silhouette simplifiée d'une basket de profil, bout à gauche : pointe basse et semelle relevée, talon haut et posé
const sneaker = '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300"><path d="M20 230 Q40 170 150 160 L300 110 Q360 60 420 70 L560 40 L580 250 L560 270 L80 270 Q30 262 20 230 Z" fill="black"/></svg>';
const left = await sharp(Buffer.from(sneaker)).png().toBuffer();
const right = await sharp(left).flop().png().toBuffer();
const a = await toeSide(left), b = await toeSide(right);
// claquette (ouverte derrière) : la bride à l'avant est la partie haute
const slide = '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="220"><path d="M20 170 Q30 60 140 60 L300 70 Q320 160 360 170 L580 175 L580 205 L60 210 Q20 205 20 170 Z" fill="black"/></svg>';
const s = await toeSide(await sharp(Buffer.from(slide)).png().toBuffer(), true);
const ok = a > 0.08 && b < -0.08 && s > 0;
console.log(`chaussure vue de côté : bout à gauche ${a.toFixed(2)}, retournée ${b.toFixed(2)}, claquette ${s.toFixed(2)} → ${ok ? 'OK' : 'ERREUR'}`);
if (!ok) process.exit(1);
