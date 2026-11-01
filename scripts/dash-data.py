# Fichiers du tableau de bord privé « Tracker Vytoxx Best Finds » (claude.ai) :
# jours.json (stats par jour, branche stats), clics.json (clics produits par jour), top.json (articles les plus cliqués).
# Usage : python3 scripts/dash-data.py [dossier de sortie]   (à lancer depuis une copie du dépôt)
import json, sys, subprocess, datetime, os
repo = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
outdir = sys.argv[1] if len(sys.argv) > 1 else '/tmp/dash'
os.makedirs(outdir, exist_ok=True)
def git_show(ref):
    try: return json.loads(subprocess.check_output(['git','-C',repo,'show',ref], stderr=subprocess.DEVNULL))
    except Exception: return None
subprocess.call(['git','-C',repo,'fetch','-q','origin','main'], stderr=subprocess.DEVNULL)
subprocess.call(['git','-C',repo,'fetch','-q','origin','stats'], stderr=subprocess.DEVNULL)
stats = git_show('FETCH_HEAD:stats.json') or {'days': [], 'top': []}
clicks = git_show('origin/main:data/clicks.json') or {}
arts = (git_show('origin/main:data/articles.json') or {}).get('articles', [])
KEYS = ['s','v','n','o','b','sh','po','p','q','app','mob','pc','rtg','rig','rsc','rtt','rwa','rweb','rdir']
NAMES = {'s':'visites','v':'visiteurs','n':'nouveaux','o':'fiches_ouvertes','b':'clics_lovegobuy','sh':'partages','po':'fenetre_500','p':'clics_inscription','q':'questions_bot','app':'ouvertures_appli','mob':'mobile','pc':'ordinateur','rtg':'src_telegram','rig':'src_instagram','rsc':'src_snapchat','rtt':'src_tiktok','rwa':'src_whatsapp','rweb':'src_autre_site','rdir':'src_direct'}
jours = []
for d in stats.get('days', []):
    jours.append({'jour': d['date'], **{NAMES[k]: int(d.get(k, 0) or 0) for k in KEYS}})
if not jours:
    jours = [{'jour': datetime.date.today().isoformat(), **{NAMES[k]: 0 for k in KEYS}}]
# clics produits par jour (ouvertures + clics LoveGoBuy, historique du classement)
hist = sorted(clicks.get('history', []), key=lambda h: h['date'])
clics = []
prev = None
for h in hist:
    tot = sum(int(v) for v in h['totals'].values())
    if prev is not None: clics.append({'jour': h['date'], 'clics_produits': max(0, tot - prev)})
    prev = tot
byid = {str(a['id']): a for a in arts}
top = [{'article': byid.get(i, {}).get('title', f'Article {i}'), 'marque': byid.get(i, {}).get('brand') or '', 'categorie': byid.get(i, {}).get('category') or '', 'clics': int(n)}
       for i, n in sorted((clicks.get('period') or {}).items(), key=lambda kv: -int(kv[1]))[:15] if i in byid and not byid[i].get('hidden')]
for name, rows in [('jours', jours), ('clics', clics), ('top', top)]:
    json.dump(rows, open(os.path.join(outdir, f'{name}.json'), 'w'), ensure_ascii=False)
print(len(jours), 'jours ;', len(clics), 'jours de clics ;', len(top), 'articles', '| maj stats :', stats.get('updatedAt'))
