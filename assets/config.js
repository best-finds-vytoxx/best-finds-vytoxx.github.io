// Réglages du site — modifie ces valeurs librement.
window.SITE = {
  name: 'Best Finds',
  by: 'Vytoxx',
  tagline: 'Toutes les trouvailles du canal, vérifiées et rangées au même endroit.',
  telegram: 'https://t.me/lovegobuy_france',
  invite: 'https://www.lovegobuy.com/?invite_code=V4LTTW', // lien d'inscription (pop-up + boutons)
  coupon: '500 €', // montant affiché dans le pop-up
  newForHours: 48, // badge « Nouveau » pendant 48 h

  // Classement « Top du moment » selon les clics vers LoveGoBuy (compteur gratuit, sans compte à créer).
  // Change « namespace » seulement si tu veux repartir de zéro (lettres, chiffres, - et _).
  clicks: {
    namespace: 'bestfinds-vytoxx',
    days: 30, // période prise en compte
  },
};
