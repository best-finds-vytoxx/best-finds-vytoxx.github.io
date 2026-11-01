// Réglages du site — modifie ces valeurs librement.
window.SITE = {
  name: 'Vytoxx Best Finds',
  by: 'Vytoxx',
  tagline: 'Les meilleurs finds de Vytoxx, photographiés par notre équipe.',
  telegram: 'https://t.me/lovegobuy_france',
  chat: 'https://t.me/LoveGoBuy_fr', // groupe de discussion (questions, liens introuvables)
  statsUrl: 'https://vytoxx-stats.jean-plouy59.workers.dev', // compteur privé (Cloudflare Worker, voir cloudflare/worker.js) ; vide = ancien compteur public
  invite: 'https://www.lovegobuy.com/?invite_code=EPHDII', // lien d'inscription (pop-up + boutons)
  coupon: '500 €', // montant affiché dans le pop-up
  newForHours: 48, // badge « Nouveau » pendant 48 h

  // Classement « Top du moment » selon les clics vers LoveGoBuy (compteur gratuit, sans compte à créer).
  // Change « namespace » seulement si tu veux repartir de zéro (lettres, chiffres, - et _).
  clicks: {
    namespace: 'bestfinds-vytoxx',
    days: 30, // période prise en compte
  },
};
