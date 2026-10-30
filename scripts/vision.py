# Détourage « vision » : 1) repère le produit dans la photo (Grounding DINO, guidé par son nom : « shoe. », « t-shirt. »…),
# 2) recadre sur le produit (la règle, la vignette du canal, la boîte et les papiers restent dehors),
# 3) détoure le recadrage avec BiRefNet (très précis, y compris pour les vêtements blancs sur la table claire).
# Processus permanent : une requête JSON par ligne sur l'entrée standard, une réponse JSON par ligne en sortie.
#   requête  : {"in": "photo.png", "out": "masque.png", "prompt": "shoe."}
#   réponse  : {"ok": true, "boxes": [[x0, y0, x1, y1, score], ...], "crop": [x0, y0, x1, y1]}
# Le masque est en niveaux de gris, de la taille de la photo : 255 = produit, 0 = fond.
import json, os, sys
import numpy as np
from PIL import Image, ImageOps

MODEL = os.environ.get('BIREFNET', 'models/birefnet-general.onnx')
SIZE = 1024


def load():
    import onnxruntime as ort, torch
    from transformers import AutoProcessor, AutoModelForZeroShotObjectDetection
    torch.set_num_threads(max(1, os.cpu_count() or 2))
    proc = AutoProcessor.from_pretrained('IDEA-Research/grounding-dino-tiny')
    det = AutoModelForZeroShotObjectDetection.from_pretrained('IDEA-Research/grounding-dino-tiny').eval()
    so = ort.SessionOptions(); so.enable_cpu_mem_arena = False
    seg = ort.InferenceSession(MODEL, so, providers=['CPUExecutionProvider'])
    return proc, det, seg, torch


def detect(proc, det, torch, im, prompt):
    inp = proc(images=im, text=prompt, return_tensors='pt')
    with torch.no_grad():
        out = det(**inp)
    r = proc.post_process_grounded_object_detection(out, inp.input_ids, threshold=0.2, text_threshold=0.2, target_sizes=[im.size[::-1]])[0]
    return sorted(([*map(float, b.tolist()), float(s)] for b, s in zip(r['boxes'], r['scores'])), key=lambda b: -b[4])


def crop_for(boxes, W, H):
    if not boxes:
        return [0, 0, W, H]
    best = boxes[0][4]
    keep = [b for b in boxes if b[4] >= max(0.28, best * 0.6)] or boxes[:1]
    # une boîte qui couvre presque toute la photo n'apporte rien : on garde les autres
    small = [b for b in keep if (b[2] - b[0]) * (b[3] - b[1]) < W * H * 0.9]
    keep = small or keep
    x0 = min(b[0] for b in keep); y0 = min(b[1] for b in keep); x1 = max(b[2] for b in keep); y1 = max(b[3] for b in keep)
    mx, my = (x1 - x0) * 0.05 + 4, (y1 - y0) * 0.05 + 4
    return [int(max(0, x0 - mx)), int(max(0, y0 - my)), int(min(W, x1 + mx)), int(min(H, y1 + my))]


def segment(seg, im):
    W, H = im.size
    x = np.asarray(im.resize((SIZE, SIZE), Image.BILINEAR), dtype=np.float32) / 255
    x = ((x - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]).transpose(2, 0, 1)[None].astype(np.float32)
    y = seg.run(None, {seg.get_inputs()[0].name: x})[-1][0, 0]
    return Image.fromarray((255 / (1 + np.exp(-y))).astype(np.uint8)).resize((W, H), Image.LANCZOS)


def main():
    proc, det, seg, torch = load()
    print(json.dumps({'ready': True}), flush=True)
    for line in sys.stdin:
        if not line.strip():
            continue
        try:
            q = json.loads(line)
            im = ImageOps.exif_transpose(Image.open(q['in'])).convert('RGB')
            W, H = im.size
            boxes = detect(proc, det, torch, im, q.get('prompt') or 'object.')
            c = crop_for(boxes, W, H)
            m = segment(seg, im.crop(c))
            full = Image.new('L', (W, H), 0)
            full.paste(m, (c[0], c[1]))
            full.save(q['out'])
            print(json.dumps({'ok': True, 'boxes': [[round(v, 1) for v in b[:4]] + [round(b[4], 3)] for b in boxes[:6]], 'crop': c}), flush=True)
        except Exception as e:  # une photo en erreur ne bloque pas les suivantes
            print(json.dumps({'ok': False, 'error': str(e)}), flush=True)


if __name__ == '__main__':
    main()
