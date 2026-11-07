#!/usr/bin/env python3
"""Assemble un APK non signé sans le SDK Android :
- AndroidManifest.xml encodé en XML binaire (format AXML),
- resources.arsc minimal (une ressource : l'icône),
- classes.dex, assets/index.html, res/drawable/icon.png.
Usage : pack.py <classes.dex> <index.html> <icon.png> <sortie.apk> <versionCode> <versionName>
"""
import struct, sys, zipfile

ANDROID_NS = 'http://schemas.android.com/apk/res/android'
ATTR_IDS = {
    'theme': 0x01010000, 'label': 0x01010001, 'icon': 0x01010002, 'name': 0x01010003, 'exported': 0x01010010,
    'launchMode': 0x0101001d, 'screenOrientation': 0x0101001e, 'configChanges': 0x0101001f,
    'minSdkVersion': 0x0101020c, 'versionCode': 0x0101021b, 'versionName': 0x0101021c,
    'targetSdkVersion': 0x01010270, 'glEsVersion': 0x01010281, 'hardwareAccelerated': 0x010102d3,
}
T_REF, T_STR, T_DEC, T_HEX, T_BOOL = 0x01, 0x03, 0x10, 0x11, 0x12
ICON_ID = 0x7F010000


def string_pool(strings):
    offs, data = [], b''
    for s in strings:
        offs.append(len(data))
        enc = s.encode('utf-16-le')
        data += struct.pack('<H', len(s)) + enc + b'\x00\x00'
    while len(data) % 4:
        data += b'\x00'
    header = 28
    start = header + 4 * len(strings)
    size = start + len(data)
    return struct.pack('<HHIIIIII', 0x0001, header, size, len(strings), 0, 0, start, 0) + b''.join(struct.pack('<I', o) for o in offs) + data


def manifest(version_code, version_name):
    # Arbre : (tag, [(ns, attr, type, valeur)], enfants)
    A = lambda name, t, v: ('android', name, t, v)
    tree = ('manifest', [A('versionCode', T_DEC, version_code), A('versionName', T_STR, version_name), (None, 'package', T_STR, 'com.boxinglegend.game')], [
        ('uses-sdk', [A('minSdkVersion', T_DEC, 24), A('targetSdkVersion', T_DEC, 34)], []),
        ('uses-feature', [A('glEsVersion', T_HEX, 0x00020000)], []),
        ('application', [A('theme', T_REF, 0x0103000A), A('label', T_STR, 'Boxing Legend'), A('icon', T_REF, ICON_ID), A('hardwareAccelerated', T_BOOL, True)], [
            ('activity', [A('name', T_STR, 'com.boxinglegend.game.MainActivity'), A('exported', T_BOOL, True), A('launchMode', T_DEC, 2),
                          A('screenOrientation', T_DEC, 6), A('configChanges', T_HEX, 0x0FF0)], [
                ('intent-filter', [], [
                    ('action', [A('name', T_STR, 'android.intent.action.MAIN')], []),
                    ('category', [A('name', T_STR, 'android.intent.category.LAUNCHER')], []),
                ]),
            ]),
        ]),
    ])
    # Pool : d'abord les noms d'attributs Android (alignés sur la table d'IDs), puis le reste.
    attr_names = sorted({a[1] for a in walk_attrs(tree) if a[0] == 'android'}, key=lambda n: ATTR_IDS[n])
    strings = list(attr_names)
    def idx(s):
        if s not in strings:
            strings.append(s)
        return strings.index(s)
    for s in ['android', ANDROID_NS]:
        idx(s)
    body = []
    line = [1]
    def elem(node):
        tag, attrs, kids = node
        attrs = sorted(attrs, key=lambda a: ATTR_IDS.get(a[1], 0x7FFFFFFF) if a[0] else 0x7FFFFFFF)
        recs = b''
        for ns, name, t, v in attrs:
            ns_i = idx(ANDROID_NS) if ns else 0xFFFFFFFF
            name_i = idx(name)
            if t == T_STR:
                raw = idx(v); data = raw
            else:
                raw = 0xFFFFFFFF
                data = (0xFFFFFFFF if v else 0) if t == T_BOOL else v
            recs += struct.pack('<IIIHBBI', ns_i, name_i, raw, 8, 0, t, data)
        body.append(struct.pack('<HHIIIIIHHHHHH', 0x0102, 16, 36 + len(recs), line[0], 0xFFFFFFFF, 0xFFFFFFFF, idx(tag), 20, 20, len(attrs), 0, 0, 0) + recs)
        line[0] += 1
        for k in kids:
            elem(k)
        body.append(struct.pack('<HHIIIII', 0x0103, 16, 24, line[0], 0xFFFFFFFF, 0xFFFFFFFF, idx(tag)))
        line[0] += 1
    ns_start = lambda: struct.pack('<HHIIIII', 0x0100, 16, 24, 1, 0xFFFFFFFF, idx('android'), idx(ANDROID_NS))
    start = ns_start()
    elem(tree)
    end = struct.pack('<HHIIIII', 0x0101, 16, 24, line[0], 0xFFFFFFFF, idx('android'), idx(ANDROID_NS))
    pool = string_pool(strings)
    resmap = struct.pack('<HHI', 0x0180, 8, 8 + 4 * len(attr_names)) + b''.join(struct.pack('<I', ATTR_IDS[n]) for n in attr_names)
    content = pool + resmap + start + b''.join(body) + end
    return struct.pack('<HHI', 0x0003, 8, 8 + len(content)) + content


def walk_attrs(node):
    tag, attrs, kids = node
    yield from attrs
    for k in kids:
        yield from walk_attrs(k)


def resources_arsc():
    gpool = string_pool(['res/drawable/icon.png'])
    type_pool = string_pool(['drawable'])
    key_pool = string_pool(['icon'])
    spec = struct.pack('<HHIBBHI', 0x0202, 16, 20, 1, 0, 0, 1) + struct.pack('<I', 0)
    config = struct.pack('<I', 64) + b'\x00' * 60
    entries = struct.pack('<HHI', 8, 0, 0) + struct.pack('<HBBI', 8, 0, T_STR, 0)
    type_hdr = 8 + 1 + 1 + 2 + 4 + 4 + 64
    offsets = struct.pack('<I', 0)
    entries_start = type_hdr + len(offsets)
    typ = struct.pack('<HHIBBHII', 0x0201, type_hdr, entries_start + len(entries), 1, 0, 0, 1, entries_start) + config + offsets + entries
    name = 'com.boxinglegend.game'.encode('utf-16-le').ljust(256, b'\x00')
    pkg_hdr = 288
    type_off = pkg_hdr
    key_off = pkg_hdr + len(type_pool)
    pkg_body = type_pool + key_pool + spec + typ
    pkg = struct.pack('<HHII', 0x0200, pkg_hdr, pkg_hdr + len(pkg_body), 0x7F) + name + struct.pack('<IIIII', type_off, 1, key_off, 1, 0) + pkg_body
    body = gpool + pkg
    return struct.pack('<HHII', 0x0002, 12, 12 + len(body), 1) + body


def main():
    dex, html, icon, out, vcode, vname = sys.argv[1:7]
    with zipfile.ZipFile(out, 'w') as z:
        def add(name, data, compress=True):
            zi = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
            zi.compress_type = zipfile.ZIP_DEFLATED if compress else zipfile.ZIP_STORED
            if not compress:
                # Alignement sur 4 octets des données non compressées (exigé pour resources.arsc).
                off = z.fp.tell() + 30 + len(name.encode())
                pad = (4 - off % 4) % 4
                zi.extra = b'\x00' * pad
            z.writestr(zi, data)
        add('AndroidManifest.xml', manifest(int(vcode), vname))
        add('resources.arsc', resources_arsc(), compress=False)
        add('classes.dex', open(dex, 'rb').read())
        add('res/drawable/icon.png', open(icon, 'rb').read(), compress=False)
        add('assets/index.html', open(html, 'rb').read())
    print('APK non signé :', out)


if __name__ == '__main__':
    main()
