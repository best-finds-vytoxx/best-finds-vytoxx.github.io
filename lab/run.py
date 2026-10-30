import json, os, sys, time, numpy as np, onnxruntime as ort, torch
from PIL import Image, ImageOps, ImageDraw
from transformers import AutoProcessor, AutoModelForZeroShotObjectDetection
torch.set_num_threads(4)
proc = AutoProcessor.from_pretrained('IDEA-Research/grounding-dino-tiny')
det = AutoModelForZeroShotObjectDetection.from_pretrained('IDEA-Research/grounding-dino-tiny').eval()
so = ort.SessionOptions(); so.intra_op_num_threads = 4
SEG = {k: ort.InferenceSession(f'models/{k}.onnx', so, providers=['CPUExecutionProvider']) for k in sys.argv[1].split(',')}

def detect(im, prompt):
    inp = proc(images=im, text=prompt, return_tensors='pt')
    with torch.no_grad(): out = det(**inp)
    r = proc.post_process_grounded_object_detection(out, inp.input_ids, threshold=0.25, text_threshold=0.2, target_sizes=[im.size[::-1]])[0]
    return [(b.tolist(), float(s), l) for b, s, l in zip(r['boxes'], r['scores'], r.get('text_labels', r['labels']))]

def segment(s, im):
    W, H = im.size
    x = np.asarray(im.resize((1024, 1024), Image.BILINEAR), dtype=np.float32) / 255
    x = ((x - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]).transpose(2, 0, 1)[None].astype(np.float32)
    y = s.run(None, {s.get_inputs()[0].name: x})[-1][0, 0]
    return Image.fromarray((255 / (1 + np.exp(-y))).astype(np.uint8)).resize((W, H), Image.BILINEAR)

def prompt_for(j):
    n = j['noun'].replace('a pair of ', '').replace('an ', '').replace('a ', '')
    if j['kind'] == 'shoe' or 'sneaker' in n or 'boots' in n: n = 'shoe'
    return n + '.'

os.makedirs('out', exist_ok=True); log = []
for j in json.load(open('lab/jobs.json')):
    f = f"images/{j['id']}/{j['photo']}.jpg"
    if not os.path.exists(f): continue
    im = ImageOps.exif_transpose(Image.open(f)).convert('RGB'); W, H = im.size
    t = time.time(); boxes = detect(im, prompt_for(j)); td = time.time() - t
    good = [b for b in boxes if b[1] >= 0.3] or boxes[:1]
    if good:
        x0 = min(b[0][0] for b in good); y0 = min(b[0][1] for b in good); x1 = max(b[0][2] for b in good); y1 = max(b[0][3] for b in good)
        mx, my = (x1 - x0) * 0.06, (y1 - y0) * 0.06
        crop = (int(max(0, x0 - mx)), int(max(0, y0 - my)), int(min(W, x1 + mx)), int(min(H, y1 + my)))
    else: crop = (0, 0, W, H)
    tiles = [im.copy()]; d = ImageDraw.Draw(tiles[0])
    for b, s_, l in boxes: d.rectangle(b, outline=(255, 0, 0) if s_ >= 0.3 else (255, 200, 0), width=4); d.text((b[0] + 6, b[1] + 6), f'{l} {s_:.2f}', fill=(255, 0, 0))
    times = {'det': round(td, 1)}
    for k, s in SEG.items():
        for mode in ('full', 'crop'):
            src = im if mode == 'full' else im.crop(crop)
            t = time.time(); m = segment(s, src); times[f'{k}-{mode}'] = round(time.time() - t, 1)
            full = Image.new('L', (W, H), 0); full.paste(m, crop[:2] if mode == 'crop' else (0, 0))
            bg = Image.new('RGB', (W, H), (42, 42, 46)); bg.paste(im, (0, 0), full); tiles.append(bg)
    th = 520; row = [t_.resize((int(W * th / H), th)) for t_ in tiles]
    sheet = Image.new('RGB', (sum(r.width for r in row) + 8 * len(row), th), (20, 20, 20)); x = 0
    for r in row: sheet.paste(r, (x, 0)); x += r.width + 8
    sheet.save(f"out/{j['id']}.jpg", quality=82)
    log.append({'id': j['id'], 'prompt': prompt_for(j), 'boxes': [(l, round(s_, 2)) for b, s_, l in boxes], 'times': times}); print(log[-1], flush=True)
json.dump(log, open('out/log.json', 'w'), indent=1)
