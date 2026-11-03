#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
穿搭素材「批量自动上传」本地脚本（WorkBuddy 自动传用）

用途：
  把一批穿搭图片（按文件名或 CSV 模板命名）直接上传到云存储并写入 outfits 集合，
  无需打开后台界面。WorkBuddy 收到你的图片文件夹后，运行本脚本即可。

元数据来源（两种，可混用）：
  A. 文件名解析（快捷）：文件名格式
        穿搭名称｜场景标签｜主色｜季节标签｜天气标签
     分隔符用全角「｜」；例：白色连衣裙｜商超｜白｜夏｜晴.jpg
     搭配说明自动等于名称（可在 CSV 覆盖）。
  B. CSV 模板（完整）：用后台「批量上传」弹窗里的「下载模板」列，按「文件名」列（不含扩展名）
     与图片一一对应，覆盖文件名解析值。列含：
     文件名,穿搭名称,搭配说明,场景标签,主色,辅助色,季节标签,天气标签,
     最低温度,最高温度,防水,防风,透气,运营优先级,库存状态

调用链路：读图 → Pillow 压缩(<700KB) → base64 → 写临时 JSON →
         tcb fn invoke adminApi -d @file（action=outfits.botUpload, serviceKey=机器凭证）
         → 云端上传云存储 + 中文标签名转字典 code + 写入 outfits（草稿态）。

前置：
  1. Pillow：pip install Pillow
  2. 机器凭证：.workbuddy/admin-service-key（WorkBuddy 已生成，不入库）
  3. tcb CLI 在 PATH 或下方 TCB 路径

用法：
  python scripts/bot_upload_outfits.py <图片目录或单张图片> [--csv 模板.csv] [--dry-run]
  --dry-run  只解析并打印将上传的元数据，不实际上传（推荐先跑一次核对）
"""
import argparse
import base64
import csv
import glob
import io
import json
import os
import re
import shutil
import subprocess
import sys

ENV = 'cloudbase-d7gr1giub2c847b49'
SEP = '｜'  # 全角竖线
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KEY_FILE = os.path.join(PROJECT_ROOT, '.workbuddy', 'admin-service-key')
TCB = shutil.which('tcb.cmd') or shutil.which('tcb') or r'C:\Users\Administrator\AppData\Roaming\npm\tcb.cmd'


def load_key():
    if not os.path.exists(KEY_FILE):
        sys.exit('缺少机器凭证：.workbuddy/admin-service-key 不存在。请先由 WorkBuddy 生成。')
    with open(KEY_FILE, 'rb') as f:
        return f.read().strip().decode()


def split_tags(s):
    if not s:
        return []
    return [t.strip() for t in re.split(r'[，,、]', s) if t.strip()]


def to_int(s):
    try:
        return int(float(s))
    except (TypeError, ValueError):
        return None


def parse_filename(name):
    stem = os.path.splitext(name)[0]
    parts = [p.strip() for p in stem.split(SEP)]
    title = parts[0] if parts and parts[0] else stem
    return {
        'title': title,
        'description': title,
        'sceneNames': split_tags(parts[1]) if len(parts) > 1 else [],
        'primaryColorNames': split_tags(parts[2]) if len(parts) > 2 else [],
        'seasonNames': split_tags(parts[3]) if len(parts) > 3 else [],
        'weatherNames': split_tags(parts[4]) if len(parts) > 4 else [],
    }


def map_row_csv(row):
    g = lambda k: (row.get(k) or '').strip()
    yes = ('是', 'true', '1', 'yes')
    return {
        'fileName': g('文件名'),
        'title': g('穿搭名称'),
        'description': g('搭配说明') or g('穿搭名称'),
        'sceneNames': split_tags(g('场景标签')),
        'primaryColorNames': split_tags(g('主色')),
        'accentColorNames': split_tags(g('辅助色')),
        'seasonNames': split_tags(g('季节标签')),
        'weatherNames': split_tags(g('天气标签')),
        'temperatureMin': to_int(g('最低温度')),
        'temperatureMax': to_int(g('最高温度')),
        'waterproof': g('防水') in yes,
        'windproof': g('防风') in yes,
        'breathable': g('透气') in yes,
        'priority': to_int(g('运营优先级')) or 0,
        'inventoryStatus': 'available' if g('库存状态') in ('', '可用') else 'unavailable',
    }


def read_csv_map(path):
    csv_map = {}
    with open(path, encoding='utf-8-sig', newline='') as f:
        for row in csv.DictReader(f):
            meta = map_row_csv(row)
            stem = os.path.splitext(meta.get('fileName', ''))[0]
            if stem:
                csv_map[stem] = meta
    return csv_map


def compress(image_path, max_bytes=700 * 1024):
    from PIL import Image
    img = Image.open(image_path).convert('RGB')
    max_side = 1280
    w, h = img.size
    if max(w, h) > max_side:
        ratio = max_side / max(w, h)
        img = img.resize((int(w * ratio), int(h * ratio)))
    quality = 85
    while True:
        buf = io.BytesIO()
        img.save(buf, 'JPEG', quality=quality)
        if buf.tell() <= max_bytes or quality <= 30:
            return buf.getvalue()
        quality -= 10


def upload_one(payload, key):
    data = {'action': 'outfits.botUpload', 'serviceKey': key, 'payload': payload}
    js = json.dumps(data, ensure_ascii=False)
    tmp = os.path.join(PROJECT_ROOT, 'tmp_botupload.json')
    with open(tmp, 'w', encoding='utf-8') as f:
        f.write(js)
    try:
        r = subprocess.run([TCB, 'fn', 'invoke', 'adminApi', '-d', '@' + tmp,
                            '--env-id', ENV], capture_output=True)
    finally:
        if os.path.exists(tmp):
            os.remove(tmp)
    out = r.stdout.decode('utf-8', 'replace')
    if '"success":true' in out:
        return True, ''
    # 提取服务端 message 便于排查
    m = re.search(r'"message":"([^"]*)"', out)
    return False, (m.group(1) if m else out[-400:])


def main():
    ap = argparse.ArgumentParser(description='穿搭素材批量自动上传')
    ap.add_argument('image_dir', help='图片目录（或单张图片）')
    ap.add_argument('--csv', help='CSV 模板（按文件名列匹配，覆盖文件名解析值）')
    ap.add_argument('--dry-run', action='store_true', help='只解析不实际上传')
    args = ap.parse_args()

    if os.path.isfile(args.image_dir):
        images = [args.image_dir]
    else:
        images = sorted(glob.glob(os.path.join(args.image_dir, '*')))
        images = [i for i in images if i.lower().endswith(('.png', '.jpg', '.jpeg', '.webp', '.gif'))]

    if not images:
        sys.exit('未找到图片文件：' + args.image_dir)

    csv_map = read_csv_map(args.csv) if args.csv else {}

    key = load_key()
    ok = fail = 0
    for img in images:
        base = os.path.basename(img)
        stem = os.path.splitext(base)[0]
        meta = csv_map.get(stem) or parse_filename(base)
        if args.dry_run:
            print('[dry] %s -> 名称=%s 场景=%s 主色=%s 季节=%s 天气=%s 说明=%s'
                  % (base, meta.get('title'), meta.get('sceneNames'),
                     meta.get('primaryColorNames'), meta.get('seasonNames'),
                     meta.get('weatherNames'), meta.get('description')))
            continue
        raw = compress(img)
        b64 = base64.b64encode(raw).decode()
        payload = dict(meta)
        payload['fileName'] = base
        payload['imageBase64'] = b64
        succ, msg = upload_one(payload, key)
        if succ:
            ok += 1
            print('OK   %s -> %s' % (base, meta.get('title')))
        else:
            fail += 1
            print('FAIL %s : %s' % (base, msg))

    if args.dry_run:
        print('\n[dry-run] 共解析 %d 张，未实际上传。' % len(images))
    else:
        print('\n合计：成功 %d 张，失败 %d 张。' % (ok, fail))


if __name__ == '__main__':
    main()
